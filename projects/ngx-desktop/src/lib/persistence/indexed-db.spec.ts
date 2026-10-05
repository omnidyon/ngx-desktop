import { DATABASE_VERSION, IndexedDbStore, LAYOUT_STORE, openDesktopDatabase, SESSION_STORE } from './indexed-db';

type Outcome = 'success' | 'error' | 'blocked' | 'blocked-then-success';

interface FakeDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): void;
  transaction(store: string): unknown;
  onversionchange: (() => void) | null;
  onclose: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
  closed: boolean;
}

/**
 * A fake IDBFactory backed by one in-memory map per store. Each `open()` uses the next outcome
 * (the last one repeats) and returns a new connection to the same data.
 */
function fakeFactory(existingStores: string[], outcomes: Outcome[] = ['success']) {
  const created: string[] = [];
  const opened: { name: string; version?: number }[] = [];
  const connections: FakeDatabase[] = [];
  const data = new Map<string, Map<string, unknown>>();
  const storeData = (name: string) => data.get(name) ?? data.set(name, new Map()).get(name)!;

  const connection = (): FakeDatabase => {
    const database: FakeDatabase = {
      objectStoreNames: { contains: (name: string) => existingStores.includes(name) || created.includes(name) },
      createObjectStore: (name: string) => void created.push(name),
      onversionchange: null,
      onclose: null,
      closed: false,
      close: vi.fn(() => (database.closed = true)),
      transaction(store: string) {
        if (database.closed) throw new DOMException('The database connection is closing.', 'InvalidStateError');
        const items = storeData(store);
        const transaction: Record<string, unknown> = {};
        const request = (run: () => unknown) => {
          const result: { result?: unknown } = {};
          setTimeout(() => {
            result.result = run();
            (transaction['oncomplete'] as () => void)?.();
          });
          return result;
        };
        transaction['objectStore'] = () => ({
          get: (key: string) => request(() => items.get(key)),
          put: (value: unknown, key: string) => request(() => items.set(key, value) && key),
          delete: (key: string) => request(() => void items.delete(key)),
          clear: () => request(() => items.clear()),
        });
        return transaction;
      },
    };
    connections.push(database);
    return database;
  };

  const factory = {
    open(name: string, version?: number) {
      const outcome = outcomes[Math.min(opened.length, outcomes.length - 1)];
      opened.push({ name, version });
      const database = connection();
      const request: Record<string, unknown> = { result: database };
      setTimeout(() => {
        if (outcome === 'error') return (request['onerror'] as () => void)();
        if (outcome === 'blocked' || outcome === 'blocked-then-success') {
          (request['onblocked'] as () => void)();
          if (outcome === 'blocked') return;
        }
        (request['onupgradeneeded'] as () => void)();
        (request['onsuccess'] as () => void)();
      });
      return request;
    },
  } as unknown as IDBFactory;
  return { factory, created, opened, connections, data: storeData };
}

describe('openDesktopDatabase', () => {
  it('creates every store in a new database', async () => {
    const fake = fakeFactory([]);
    expect(await openDesktopDatabase(fake.factory, 'db')).toBe(fake.connections[0]);
    expect(fake.created).toEqual([LAYOUT_STORE, SESSION_STORE]);
    expect(fake.opened).toEqual([{ name: 'db', version: DATABASE_VERSION }]);
  });

  it('only adds the missing store when upgrading from version 1, keeping saved layouts', async () => {
    const fake = fakeFactory([LAYOUT_STORE]);
    await openDesktopDatabase(fake.factory, 'db');
    expect(fake.created).toEqual([SESSION_STORE]);
  });

  it('closes itself and reports it when a newer version wants to upgrade', async () => {
    const fake = fakeFactory([]);
    const onClosed = vi.fn();
    await openDesktopDatabase(fake.factory, 'db', { onClosed });
    fake.connections[0].onversionchange?.();
    expect(fake.connections[0].close).toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalled();
  });

  it('reports a connection the browser closed', async () => {
    const fake = fakeFactory([]);
    const onClosed = vi.fn();
    await openDesktopDatabase(fake.factory, 'db', { onClosed });
    fake.connections[0].onclose?.();
    expect(onClosed).toHaveBeenCalled();
  });

  it('resolves null without IndexedDB, on errors and when blocked', async () => {
    const onBlocked = vi.fn();
    expect(await openDesktopDatabase(undefined)).toBeNull();
    expect(await openDesktopDatabase(fakeFactory([], ['error']).factory)).toBeNull();
    expect(await openDesktopDatabase(fakeFactory([], ['blocked']).factory, 'db', { onBlocked })).toBeNull();
    expect(onBlocked).toHaveBeenCalled();
  });

  it('closes a connection that only opens after the attempt was given up as blocked', async () => {
    const fake = fakeFactory([], ['blocked-then-success']);
    expect(await openDesktopDatabase(fake.factory, 'db')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve));
    expect(fake.connections[0].close).toHaveBeenCalled();
  });
});

describe('IndexedDbStore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps working after another tab upgraded the database', async () => {
    const fake = fakeFactory([]);
    const store = new IndexedDbStore<string>(LAYOUT_STORE, 'db', fake.factory, 'warning');
    await store.put('a', 'first');

    // Another tab upgrades the database: this connection is closed.
    fake.connections[0].onversionchange?.();
    await store.put('b', 'second');

    expect(fake.opened).toHaveLength(2);
    expect(await store.get('a')).toBe('first');
    expect(fake.data(LAYOUT_STORE).get('b')).toBe('second');
  });

  it('falls back to memory while blocked, then goes back to IndexedDB', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeFactory([], ['blocked', 'success']);
    const store = new IndexedDbStore<string>(LAYOUT_STORE, 'db', fake.factory, 'kept in memory');

    await store.put('a', 'while blocked');
    expect(fake.data(LAYOUT_STORE).has('a')).toBe(false);
    expect(warn).toHaveBeenCalledWith('kept in memory');

    await store.put('b', 'after');
    expect(fake.opened).toHaveLength(2);
    expect(fake.data(LAYOUT_STORE).get('b')).toBe('after');
  });

  it('stays in memory for good when IndexedDB does not exist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new IndexedDbStore<string>(LAYOUT_STORE, 'db', undefined, 'no IndexedDB');
    await store.put('a', 'value');
    expect(await store.get('a')).toBe('value');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
