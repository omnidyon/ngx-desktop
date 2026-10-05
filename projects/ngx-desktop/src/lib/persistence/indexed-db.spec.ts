import { DATABASE_VERSION, LAYOUT_STORE, openDesktopDatabase, SESSION_STORE } from './indexed-db';

/** A fake IDBFactory that runs the upgrade for a database that already has `existingStores`. */
function fakeFactory(existingStores: string[], outcome: 'success' | 'error' | 'blocked' = 'success') {
  const created: string[] = [];
  const opened: { name: string; version?: number }[] = [];
  const database = {
    objectStoreNames: { contains: (name: string) => existingStores.includes(name) || created.includes(name) },
    createObjectStore: (name: string) => created.push(name),
    onversionchange: null as (() => void) | null,
    close: vi.fn(),
  };
  const factory = {
    open(name: string, version?: number) {
      opened.push({ name, version });
      const request: Record<string, unknown> = { result: database };
      setTimeout(() => {
        if (outcome === 'error') return (request['onerror'] as () => void)();
        if (outcome === 'blocked') return (request['onblocked'] as () => void)();
        (request['onupgradeneeded'] as () => void)();
        (request['onsuccess'] as () => void)();
      });
      return request;
    },
  } as unknown as IDBFactory;
  return { factory, created, opened, database };
}

describe('openDesktopDatabase', () => {
  it('creates every store in a new database', async () => {
    const fake = fakeFactory([]);
    expect(await openDesktopDatabase(fake.factory, 'db')).toBe(fake.database);
    expect(fake.created).toEqual([LAYOUT_STORE, SESSION_STORE]);
    expect(fake.opened).toEqual([{ name: 'db', version: DATABASE_VERSION }]);
  });

  it('only adds the missing store when upgrading from version 1, keeping saved layouts', async () => {
    const fake = fakeFactory([LAYOUT_STORE]);
    await openDesktopDatabase(fake.factory, 'db');
    expect(fake.created).toEqual([SESSION_STORE]);
  });

  it('closes itself when a newer version wants to upgrade', async () => {
    const fake = fakeFactory([]);
    await openDesktopDatabase(fake.factory, 'db');
    fake.database.onversionchange?.();
    expect(fake.database.close).toHaveBeenCalled();
  });

  it('resolves null without IndexedDB, on errors and when blocked', async () => {
    expect(await openDesktopDatabase(undefined)).toBeNull();
    expect(await openDesktopDatabase(fakeFactory([], 'error').factory)).toBeNull();
    expect(await openDesktopDatabase(fakeFactory([], 'blocked').factory)).toBeNull();
  });
});
