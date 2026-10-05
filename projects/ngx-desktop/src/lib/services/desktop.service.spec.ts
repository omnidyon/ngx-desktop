import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideDesktopConfig } from '../config/desktop-config';
import { DesktopWindow } from '../models/desktop-window';
import { Rect } from '../models/types';
import { DesktopService } from './desktop.service';

function fakeWindow(id: string, visible = true): DesktopWindow & { visible: ReturnType<typeof signal<boolean>> } {
  return {
    id,
    header: signal(id),
    icon: signal<string | undefined>(undefined),
    visible: signal(visible),
    minimized: signal(false),
    rect: signal<Rect | null>(null),
    restore: vi.fn(),
  };
}

describe('DesktopService', () => {
  let service: DesktopService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesktopService, provideDesktopConfig({ zIndex: { window: 100 } })],
    });
    service = TestBed.inject(DesktopService);
  });

  it('registers windows in order', () => {
    service.register(fakeWindow('a'));
    service.register(fakeWindow('b'));
    expect(service.windows().map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('stacks newly registered windows on top', () => {
    service.register(fakeWindow('a'));
    service.register(fakeWindow('b'));
    expect(service.focusedId()).toBe('b');
    expect(service.zIndex('a')).toBe(100);
    expect(service.zIndex('b')).toBe(101);
  });

  it('brings a focused window to the top without changing registration order', () => {
    service.register(fakeWindow('a'));
    service.register(fakeWindow('b'));
    service.register(fakeWindow('c'));
    service.focus('a');
    expect(service.focusedId()).toBe('a');
    expect([service.zIndex('b'), service.zIndex('c'), service.zIndex('a')]).toEqual([100, 101, 102]);
    expect(service.windows().map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores focus for unknown ids', () => {
    service.register(fakeWindow('a'));
    service.focus('nope');
    expect(service.focusedId()).toBe('a');
  });

  it('unregisters windows from the registry and the stack', () => {
    service.register(fakeWindow('a'));
    service.register(fakeWindow('b'));
    service.unregister('b');
    expect(service.windows().map((w) => w.id)).toEqual(['a']);
    expect(service.focusedId()).toBe('a');
  });

  it('has no focused window when empty', () => {
    expect(service.focusedId()).toBeNull();
  });

  it('lists only visible windows as open', () => {
    const a = fakeWindow('a');
    service.register(a);
    service.register(fakeWindow('b', false));
    expect(service.openWindows().map((w) => w.id)).toEqual(['a']);
    a.visible.set(false);
    expect(service.openWindows()).toEqual([]);
  });

  it('reports the attached container size as bounds', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { value: 640 });
    Object.defineProperty(element, 'clientHeight', { value: 480 });
    service.attachContainer(element);
    expect(service.bounds()).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it('reports empty bounds without a container', () => {
    expect(service.bounds()).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
