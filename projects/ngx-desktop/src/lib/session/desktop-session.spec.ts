import { TestBed } from '@angular/core/testing';
import { ForgottenLayouts } from '../persistence/forgotten-layouts';
import { InMemoryLayoutStorage } from '../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../persistence/layout-storage.provider';
import { WindowLayout } from '../persistence/window-layout';
import { DesktopSession, injectDesktopSession } from './desktop-session';
import { InMemorySessionStorage, provideDesktopSessionStorage, SessionRecord } from './session-storage';

interface Doc {
  title: string;
}

const layout: WindowLayout = {
  version: 1,
  rect: { x: 1, y: 2, width: 300, height: 200 },
  zone: null,
  restoreSize: null,
  minimized: false,
  maximized: false,
  visible: true,
};

/** Lets pending storage promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('DesktopSession', () => {
  let sessions: InMemorySessionStorage;
  let layouts: InMemoryLayoutStorage;

  const create = (key = 'docs'): DesktopSession<Doc> =>
    TestBed.runInInjectionContext(() => injectDesktopSession<Doc>(key));
  const stored = async (key = 'docs') => (await sessions.load(key)) as SessionRecord<Doc> | null;

  beforeEach(() => {
    sessions = new InMemorySessionStorage();
    layouts = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({
      providers: [provideDesktopSessionStorage(sessions), provideDesktopLayoutStorage(layouts)],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts empty and reports when it has loaded', async () => {
    const session = create();
    expect(session.windows()).toEqual([]);
    await settle();
    expect(session.loaded()).toBe(true);
  });

  it('opens windows with unique keys and persists them', async () => {
    const session = create();
    const a = session.open({ title: 'A' });
    const b = session.open({ title: 'B' });
    expect(a).not.toBe(b);
    expect(a.startsWith('docs:')).toBe(true);
    expect(session.windows()).toEqual([
      { key: a, data: { title: 'A' } },
      { key: b, data: { title: 'B' } },
    ]);
    await settle();
    expect((await stored())?.windows.map((w) => w.data.title)).toEqual(['A', 'B']);
  });

  it('uses a given key, replacing a window with the same key', () => {
    const session = create();
    session.open({ title: 'A' }, 'one');
    session.open({ title: 'A2' }, 'one');
    expect(session.windows()).toEqual([{ key: 'one', data: { title: 'A2' } }]);
  });

  it('restores the saved windows when created', async () => {
    await sessions.save('docs', { version: 1, windows: [{ key: 'k1', data: { title: 'Saved' } }] });
    const session = create();
    await settle();
    expect(session.windows()).toEqual([{ key: 'k1', data: { title: 'Saved' } }]);
  });

  it('keeps windows opened before loading finished, after the restored ones', async () => {
    await sessions.save('docs', { version: 1, windows: [{ key: 'k1', data: { title: 'Saved' } }] });
    const session = create();
    session.open({ title: 'Early' }, 'k2');
    await settle();
    expect(session.windows().map((w) => w.key)).toEqual(['k1', 'k2']);
    expect((await stored())?.windows.map((w) => w.key)).toEqual(['k1', 'k2']);
  });

  it('updates the data of a window', async () => {
    const session = create();
    const key = session.open({ title: 'A' });
    session.update(key, { title: 'Renamed' });
    session.update('unknown', { title: 'ignored' });
    expect(session.windows()).toEqual([{ key, data: { title: 'Renamed' } }]);
    await settle();
    expect((await stored())?.windows[0].data.title).toBe('Renamed');
  });

  it('closes a window: removes it, persists and forgets its layout', async () => {
    const session = create();
    const key = session.open({ title: 'A' });
    await layouts.save(key, layout);
    session.close(key);
    await settle();
    expect(session.windows()).toEqual([]);
    expect((await stored())?.windows).toEqual([]);
    expect(await layouts.load(key)).toBeNull();
    expect(TestBed.inject(ForgottenLayouts).has(key)).toBe(true);
  });

  it('ignores closing an unknown key', async () => {
    const session = create();
    session.open({ title: 'A' }, 'a');
    const remove = vi.spyOn(layouts, 'remove');
    session.close('nope');
    expect(session.windows()).toHaveLength(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('clears every window and its layout', async () => {
    const session = create();
    const a = session.open({ title: 'A' });
    const b = session.open({ title: 'B' });
    await layouts.save(a, layout);
    await layouts.save(b, layout);
    session.clear();
    await settle();
    expect(session.windows()).toEqual([]);
    expect(await layouts.load(a)).toBeNull();
    expect(await layouts.load(b)).toBeNull();
  });

  it('revives a forgotten key when it is opened again', () => {
    const session = create();
    session.open({ title: 'A' }, 'same');
    session.close('same');
    session.open({ title: 'A again' }, 'same');
    expect(TestBed.inject(ForgottenLayouts).has('same')).toBe(false);
  });

  it('writes in order, so the stored list matches the last change', async () => {
    const session = create();
    const save = vi.spyOn(sessions, 'save');
    for (let i = 0; i < 5; i++) session.open({ title: `W${i}` }, `k${i}`);
    session.close('k2');
    await settle();
    expect(save).toHaveBeenCalledTimes(6);
    expect((await stored())?.windows.map((w) => w.key)).toEqual(['k0', 'k1', 'k3', 'k4']);
  });

  it('whenSaved() resolves after the pending writes', async () => {
    const session = create();
    session.open({ title: 'A' }, 'a');
    session.clear();
    await session.whenSaved();
    expect((await stored())?.windows).toEqual([]);
  });

  it('keeps separate sessions apart', async () => {
    const docs = create('docs');
    const notes = create('notes');
    docs.open({ title: 'Doc' });
    notes.open({ title: 'Note' });
    await settle();
    expect((await stored('docs'))?.windows.map((w) => w.data.title)).toEqual(['Doc']);
    expect((await stored('notes'))?.windows.map((w) => w.data.title)).toEqual(['Note']);
  });

  it('warns but keeps working when storage fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(sessions, 'load').mockRejectedValue(new Error('broken'));
    vi.spyOn(sessions, 'save').mockRejectedValue(new Error('quota'));
    const session = create();
    session.open({ title: 'A' }, 'a');
    await settle();
    expect(session.loaded()).toBe(true);
    expect(session.windows()).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('drops invalid stored windows and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await sessions.save('docs', {
      version: 1,
      windows: [{ key: 'ok', data: { title: 'Kept' } }, { key: 42, data: {} }, null, { data: {} }, { key: '' }],
    } as unknown as SessionRecord);
    const session = create();
    await settle();
    expect(session.windows()).toEqual([{ key: 'ok', data: { title: 'Kept' } }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('ignores a record without a window list', async () => {
    await sessions.save('docs', { version: 1, windows: 'nope' } as unknown as SessionRecord);
    const session = create();
    await settle();
    expect(session.windows()).toEqual([]);
  });

  it('ignores records of an unknown version', async () => {
    await sessions.save('docs', { version: 2, windows: [{ key: 'x', data: {} }] } as unknown as SessionRecord);
    const session = create();
    await settle();
    expect(session.windows()).toEqual([]);
  });
});
