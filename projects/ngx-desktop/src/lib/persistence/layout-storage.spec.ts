import { TestBed } from '@angular/core/testing';
import { IndexedDbLayoutStorage } from './indexed-db-layout-storage';
import { InMemoryLayoutStorage } from './layout-storage';
import { DESKTOP_LAYOUT_STORAGE, provideDesktopLayoutStorage } from './layout-storage.provider';
import { WindowLayout } from './window-layout';

const layout = (x: number): WindowLayout => ({
  version: 1,
  rect: { x, y: 20, width: 300, height: 200 },
  zone: null,
  restoreSize: null,
  minimized: false,
  maximized: false,
  visible: true,
});

describe('InMemoryLayoutStorage', () => {
  let storage: InMemoryLayoutStorage;

  beforeEach(() => (storage = new InMemoryLayoutStorage()));

  it('returns null for unknown keys', async () => {
    expect(await storage.load('nope')).toBeNull();
  });

  it('saves, loads, overwrites and removes layouts', async () => {
    await storage.save('a', layout(1));
    await storage.save('a', layout(2));
    expect(await storage.load('a')).toEqual(layout(2));
    await storage.remove('a');
    expect(await storage.load('a')).toBeNull();
  });

  it('clears every layout', async () => {
    await storage.save('a', layout(1));
    await storage.save('b', layout(2));
    await storage.clear();
    expect(await storage.load('a')).toBeNull();
    expect(await storage.load('b')).toBeNull();
  });

  it('stores copies, so later changes to the object are not persisted', async () => {
    const saved = layout(1);
    await storage.save('a', saved);
    saved.rect.x = 999;
    const loaded = await storage.load('a');
    loaded!.rect.y = 999;
    expect(await storage.load('a')).toEqual(layout(1));
  });
});

describe('IndexedDbLayoutStorage without IndexedDB', () => {
  afterEach(() => vi.restoreAllMocks());

  it('falls back to memory and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new IndexedDbLayoutStorage('test', undefined);
    await storage.save('a', layout(5));
    expect(await storage.load('a')).toEqual(layout(5));
    await storage.remove('a');
    expect(await storage.load('a')).toBeNull();
    await storage.clear();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to memory when opening the database throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const factory = {
      open: () => {
        throw new Error('blocked');
      },
    } as unknown as IDBFactory;
    const storage = new IndexedDbLayoutStorage('test', factory);
    await storage.save('a', layout(7));
    expect(await storage.load('a')).toEqual(layout(7));
  });
});

describe('DESKTOP_LAYOUT_STORAGE', () => {
  it('defaults to IndexedDB storage', () => {
    expect(TestBed.inject(DESKTOP_LAYOUT_STORAGE)).toBeInstanceOf(IndexedDbLayoutStorage);
  });

  it('can be replaced', () => {
    const storage = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(storage)] });
    expect(TestBed.inject(DESKTOP_LAYOUT_STORAGE)).toBe(storage);
  });
});
