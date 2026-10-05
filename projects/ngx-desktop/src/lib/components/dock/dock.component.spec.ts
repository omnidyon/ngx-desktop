import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DesktopWindow } from '../../models/desktop-window';
import { Rect } from '../../models/types';
import { DesktopService } from '../../services/desktop.service';
import { DockComponent } from './dock.component';

function fakeWindow(id: string, header: string, icon?: string): DesktopWindow {
  return {
    id,
    header: signal(header),
    icon: signal(icon),
    visible: signal(true),
    minimized: signal(false),
    maximized: signal(false),
    dockable: signal(true),
    rect: signal<Rect | null>(null),
    restore: vi.fn(),
  };
}

describe('DockComponent', () => {
  let service: DesktopService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesktopService] });
    service = TestBed.inject(DesktopService);
  });

  async function render() {
    const fixture = TestBed.createComponent(DockComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is hidden when there are no windows', async () => {
    const element = await render();
    expect(element.classList).toContain('omni-dock-empty');
  });

  it('renders a labelled tab per window', async () => {
    service.register(fakeWindow('a', 'Alpha'));
    service.register(fakeWindow('b', 'Beta', 'beta.svg'));
    const element = await render();
    const tabs = element.querySelectorAll('.omni-dock-tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('aria-label')).toBe('Alpha');
    expect(tabs[1].querySelector('img')?.getAttribute('src')).toBe('beta.svg');
  });

  it('leaves out windows that are not dockable (widgets)', async () => {
    service.register(fakeWindow('a', 'Window'));
    const widget = { ...fakeWindow('b', 'Widget'), dockable: signal(false) };
    service.register(widget);
    const element = await render();
    const labels = Array.from(element.querySelectorAll('.omni-dock-tab')).map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Window']);
  });

  it('is hidden when only widgets are open', async () => {
    service.register({ ...fakeWindow('b', 'Widget'), dockable: signal(false) });
    const element = await render();
    expect(element.classList).toContain('omni-dock-empty');
  });

  it('restores the window when its tab is clicked', async () => {
    const window = fakeWindow('a', 'Alpha');
    service.register(window);
    const element = await render();
    element.querySelector<HTMLButtonElement>('.omni-dock-tab')!.click();
    expect(window.restore).toHaveBeenCalled();
  });

  it('uses the dock z-index from the config', async () => {
    const element = await render();
    expect(element.style.zIndex).toBe('1500');
  });

  describe('arrow keys', () => {
    let element: HTMLElement;
    const tabs = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.omni-dock-tab'));
    const tabStops = () => tabs().map((tab) => tab.tabIndex);
    const focused = () => document.activeElement?.getAttribute('aria-label');

    async function press(key: string): Promise<KeyboardEvent> {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.activeElement!.dispatchEvent(event);
      await TestBed.inject(ApplicationRef).whenStable();
      return event;
    }

    beforeEach(async () => {
      service.register(fakeWindow('a', 'Alpha'));
      service.register(fakeWindow('b', 'Beta'));
      service.register(fakeWindow('c', 'Gamma'));
      service.focus('b');
      element = await render();
    });

    it('makes the dock a single tab stop, at the focused window', () => {
      expect(tabStops()).toEqual([-1, 0, -1]);
    });

    it('moves between tabs, wrapping around, and keeps the tab stop on the last one focused', async () => {
      tabs()[1].focus();
      expect((await press('ArrowRight')).defaultPrevented).toBe(true);
      expect(focused()).toBe('Gamma');
      await press('ArrowRight');
      expect(focused()).toBe('Alpha');
      await press('ArrowLeft');
      expect(focused()).toBe('Gamma');
      expect(tabStops()).toEqual([-1, -1, 0]);
    });

    it('goes to the first and last tab with Home and End', async () => {
      tabs()[1].focus();
      await press('End');
      expect(focused()).toBe('Gamma');
      await press('Home');
      expect(focused()).toBe('Alpha');
    });

    it('leaves other keys alone', async () => {
      tabs()[1].focus();
      expect((await press('Enter')).defaultPrevented).toBe(false);
      expect(focused()).toBe('Beta');
    });
  });
});
