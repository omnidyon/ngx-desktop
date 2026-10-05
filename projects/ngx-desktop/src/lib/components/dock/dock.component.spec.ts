import { signal } from '@angular/core';
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
});
