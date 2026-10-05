import { TestBed } from '@angular/core/testing';
import {
  DESKTOP_SESSION_STORAGE,
  IndexedDbSessionStorage,
  InMemorySessionStorage,
  provideDesktopSessionStorage,
  SessionRecord,
} from './session-storage';

const record = (title: string): SessionRecord => ({ version: 1, windows: [{ key: 'k', data: { title } }] });

describe('InMemorySessionStorage', () => {
  it('saves, loads, overwrites and removes records', async () => {
    const storage = new InMemorySessionStorage();
    expect(await storage.load('s')).toBeNull();
    await storage.save('s', record('A'));
    await storage.save('s', record('B'));
    expect(await storage.load('s')).toEqual(record('B'));
    await storage.remove('s');
    expect(await storage.load('s')).toBeNull();
  });

  it('stores copies', async () => {
    const storage = new InMemorySessionStorage();
    const saved = record('A');
    await storage.save('s', saved);
    saved.windows.length = 0;
    expect(await storage.load('s')).toEqual(record('A'));
  });
});

describe('IndexedDbSessionStorage without IndexedDB', () => {
  afterEach(() => vi.restoreAllMocks());

  it('falls back to memory and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new IndexedDbSessionStorage('test', undefined);
    await storage.save('s', record('A'));
    expect(await storage.load('s')).toEqual(record('A'));
    await storage.remove('s');
    expect(await storage.load('s')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('DESKTOP_SESSION_STORAGE', () => {
  it('defaults to IndexedDB storage', () => {
    expect(TestBed.inject(DESKTOP_SESSION_STORAGE)).toBeInstanceOf(IndexedDbSessionStorage);
  });

  it('can be replaced', () => {
    const storage = new InMemorySessionStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopSessionStorage(storage)] });
    expect(TestBed.inject(DESKTOP_SESSION_STORAGE)).toBe(storage);
  });
});
