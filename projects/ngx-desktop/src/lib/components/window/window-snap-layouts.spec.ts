import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { zoneRect } from '../../geometry/snap-zones';
import { SnapZone } from '../../models/types';
import { DesktopService, LAYOUT_PICKER_CLOSE_DELAY } from '../../services/desktop.service';
import { DesktopComponent } from '../desktop/desktop.component';
import { LAYOUT_HOVER_DELAY, LAYOUT_LONG_PRESS, WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [snapLayouts]="layouts()" [snapToZones]="zones()">
      <omni-window header="A" [x]="10" [y]="10" [width]="200" [height]="100" (snapped)="snaps.push($event)" />
    </omni-desktop>
    <button type="button" class="outside">outside</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly layouts = signal(true);
  readonly zones = signal(true);
  snaps: (SnapZone | null)[] = [];
}

@Component({
  imports: [WindowComponent],
  template: `<omni-window header="S" [width]="200" [height]="100" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StandaloneHostComponent {}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Desktop is 800 × 600. */
describe('Window snap layouts', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;
  let width = 800;

  const win = () => host.window();
  const flyout = () => element.querySelector<HTMLElement>('omni-snap-layouts');
  const zone = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.omni-snap-zone')].find(
      (z) => z.getAttribute('aria-label') === label
    )!;
  const maximizeButton = () =>
    [...element.querySelectorAll<HTMLButtonElement>('.omni-window-button')].find(
      (b) => b.getAttribute('aria-label') === 'Maximize'
    )!;
  const stable = () => fixture.whenStable();

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    setup(host);
    await stable();
    await wait(0);
    await stable();
  }

  async function hover(target: HTMLElement, type: 'mouseenter' | 'mouseleave'): Promise<void> {
    target.dispatchEvent(new MouseEvent(type));
    await stable();
  }

  async function openByHover(): Promise<void> {
    await hover(maximizeButton(), 'mouseenter');
    await wait(LAYOUT_HOVER_DELAY + 20);
    await stable();
  }

  beforeEach(() => {
    width = 800;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  it('opens after the pointer rests on the maximize button, offering every layout', async () => {
    await create();
    await hover(maximizeButton(), 'mouseenter');
    await wait(LAYOUT_HOVER_DELAY / 2);
    await stable();
    expect(flyout()).toBeNull();
    await wait(LAYOUT_HOVER_DELAY / 2 + 20);
    await stable();
    expect(flyout()).not.toBeNull();
    expect(flyout()!.getAttribute('aria-label')).toBe('Snap layouts');
    expect(flyout()!.querySelectorAll('.omni-snap-layout')).toHaveLength(6);
    expect(flyout()!.querySelectorAll('.omni-snap-zone')).toHaveLength(16);
    expect(maximizeButton().getAttribute('aria-keyshortcuts')).toBe('Alt+Z');
  });

  it('does not open when the pointer only passes over the button', async () => {
    await create();
    await hover(maximizeButton(), 'mouseenter');
    await hover(maximizeButton(), 'mouseleave');
    await wait(LAYOUT_HOVER_DELAY + 20);
    await stable();
    expect(flyout()).toBeNull();
  });

  it('stays open while the pointer moves into it, and closes once it leaves', async () => {
    await create();
    await openByHover();
    await hover(maximizeButton(), 'mouseleave');
    await hover(flyout()!, 'mouseenter');
    await wait(LAYOUT_PICKER_CLOSE_DELAY + 20);
    await stable();
    expect(flyout()).not.toBeNull();

    await hover(flyout()!, 'mouseleave');
    await wait(LAYOUT_PICKER_CLOSE_DELAY + 20);
    await stable();
    expect(flyout()).toBeNull();
  });

  it('snaps the window into the chosen zone and closes', async () => {
    await create();
    await openByHover();
    zone('Middle third').click();
    await stable();
    expect(flyout()).toBeNull();
    expect(win().rect()).toEqual(zoneRect('centerthird', { x: 0, y: 0, width: 800, height: 600 }));
    expect(host.snaps).toEqual(['centerthird']);
  });

  it('keeps the window in its zone when the desktop is resized', async () => {
    await create();
    await openByHover();
    zone('Bottom right').click();
    await stable();
    width = 600;
    fixture.debugElement.query(By.directive(DesktopComponent)).injector.get(DesktopService).updateSize();
    await stable();
    expect(win().rect()).toEqual(zoneRect('bottomrightthird', { x: 0, y: 0, width: 600, height: 600 }));
  });

  it('still maximizes on a plain click', async () => {
    await create();
    maximizeButton().click();
    await stable();
    expect(win().maximized()).toBe(true);
    expect(flyout()).toBeNull();
  });

  it('opens with Alt+Z on the title bar, starting on the first zone; Escape returns focus', async () => {
    await create();
    const header = element.querySelector<HTMLElement>('.omni-window-header')!;
    header.focus();
    header.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', altKey: true, bubbles: true, cancelable: true })
    );
    await stable();
    await wait(0);
    expect(flyout()).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Left half');

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    await stable();
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(header);
  });

  it('returns focus to the title bar after choosing from the keyboard', async () => {
    await create();
    const header = element.querySelector<HTMLElement>('.omni-window-header')!;
    header.focus();
    header.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', altKey: true, bubbles: true, cancelable: true })
    );
    await stable();
    await wait(0);
    zone('Right third').click();
    await stable();
    expect(host.snaps).toEqual(['rightthird']);
    expect(document.activeElement).toBe(header);
  });

  it('opens on a long press on touch screens, without maximizing', async () => {
    await create();
    const button = maximizeButton();
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 3 }));
    await wait(LAYOUT_LONG_PRESS + 20);
    await stable();
    expect(flyout()).not.toBeNull();
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 3 }));
    button.click();
    await stable();
    expect(win().maximized()).toBe(false);
  });

  it('closes on a press outside it', async () => {
    await create();
    await openByHover();
    element.querySelector('.outside')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await stable();
    expect(flyout()).toBeNull();
  });

  it('closes when the window is closed or minimized', async () => {
    await create();
    await openByHover();
    win().close();
    await stable();
    expect(flyout()).toBeNull();

    win().restore();
    await stable();
    await openByHover();
    win().minimize();
    await stable();
    expect(flyout()).toBeNull();
  });

  it('closes when snap layouts are switched off while it is open', async () => {
    await create();
    await openByHover();
    host.layouts.set(false);
    await stable();
    expect(flyout()).toBeNull();
  });

  it('is not offered when snap layouts or zone snapping are off', async () => {
    await create((h) => h.layouts.set(false));
    await openByHover();
    expect(flyout()).toBeNull();
    expect(maximizeButton().getAttribute('aria-keyshortcuts')).toBeNull();

    host.layouts.set(true);
    host.zones.set(false);
    await stable();
    await openByHover();
    expect(flyout()).toBeNull();
  });

  it('is not offered outside a desktop', async () => {
    const standalone = TestBed.createComponent(StandaloneHostComponent);
    await standalone.whenStable();
    const button = [
      ...(standalone.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.omni-window-button'),
    ].find((b) => b.getAttribute('aria-label') === 'Maximize')!;
    button.dispatchEvent(new MouseEvent('mouseenter'));
    await wait(LAYOUT_HOVER_DELAY + 20);
    await standalone.whenStable();
    expect(document.querySelector('omni-snap-layouts')).toBeNull();
  });
});
