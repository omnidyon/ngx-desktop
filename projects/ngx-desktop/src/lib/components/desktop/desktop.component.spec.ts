import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DesktopTheme, DockPosition } from '../../models/types';
import { WindowComponent } from '../window/window.component';
import { DesktopComponent } from './desktop.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [theme]="theme()" [dock]="dock()">
      <omni-window header="One" position="topleft" [width]="200" [height]="100" />
      <omni-window header="Two" icon="two.svg" position="bottomright" [width]="200" [height]="100" />
      @if (third()) {
        <omni-window header="Three" [width]="200" [height]="100" />
      }
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly theme = signal<DesktopTheme | undefined>(undefined);
  readonly dock = signal<DockPosition>('bottom');
  readonly third = signal(true);
}

describe('DesktopComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const desktop = (): HTMLElement => element.querySelector('omni-desktop')!;
  const windowEls = (): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>('omni-window'));
  const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.omni-dock-tab'));
  const stable = () => fixture.whenStable();

  beforeEach(async () => {
    // jsdom has no layout; give every element a fixed client size so the desktop has bounds.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await stable();
  });

  afterEach(() => vi.restoreAllMocks());

  it('places windows inside the desktop bounds', () => {
    const [one, two] = host.windows();
    expect(one.rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(two.rect()).toEqual({ x: 600, y: 500, width: 200, height: 100 });
    expect(windowEls()[0].classList).not.toContain('omni-window-standalone');
  });

  it('shows a dock tab per window with icon or header text', () => {
    expect(tabs()).toHaveLength(3);
    expect(tabs()[0].textContent?.trim()).toBe('One');
    expect(tabs()[1].querySelector('img')?.getAttribute('src')).toBe('two.svg');
  });

  it('stacks later windows on top and raises a window on pointerdown', async () => {
    const z = () => windowEls().map((w) => Number(w.style.zIndex));
    const [one, two, three] = z();
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
    expect(windowEls()[2].classList).toContain('omni-window-focused');

    windowEls()[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    await stable();
    expect(Math.max(...z())).toBe(z()[0]);
    expect(windowEls()[0].classList).toContain('omni-window-focused');
  });

  it('minimizes a window into the dock and restores it from its tab', async () => {
    const [one] = host.windows();
    one.toggleMinimize();
    await stable();
    expect(windowEls()[0].classList).toContain('omni-window-away');
    expect(windowEls()[0].classList).not.toContain('omni-window-collapsed');
    expect(tabs()[0].classList).toContain('omni-dock-tab-minimized');

    tabs()[0].click();
    await stable();
    expect(one.minimized()).toBe(false);
    expect(windowEls()[0].classList).not.toContain('omni-window-away');
    expect(windowEls()[0].classList).toContain('omni-window-focused');
  });

  it('brings a window to the front when its tab is clicked', async () => {
    tabs()[0].click();
    await stable();
    expect(windowEls()[0].classList).toContain('omni-window-focused');
  });

  it('removes the tab of a closed window', async () => {
    host.windows()[1].close();
    await stable();
    expect(tabs().map((t) => t.getAttribute('aria-label'))).toEqual(['One', 'Three']);
  });

  it('unregisters windows that are removed from the template', async () => {
    host.third.set(false);
    await stable();
    expect(tabs()).toHaveLength(2);
  });

  it('applies the theme class to the desktop', async () => {
    host.theme.set('aqua');
    await stable();
    expect(desktop().classList).toContain('omni-theme-aqua');
  });

  it('moves or hides the dock', async () => {
    expect(element.querySelector('omni-dock')?.classList).toContain('omni-dock-bottom');
    host.dock.set('top');
    await stable();
    expect(element.querySelector('omni-dock')?.classList).toContain('omni-dock-top');
    host.dock.set('none');
    await stable();
    expect(element.querySelector('omni-dock')).toBeNull();
  });
});
