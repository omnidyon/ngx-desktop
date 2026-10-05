import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Rect, SnapZone } from '../../models/types';
import { DesktopComponent } from '../desktop/desktop.component';
import { ANNOUNCE_DELAY, WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [allowOverlap]="allow()" [snapToWindows]="magnetic()">
      <omni-window
        class="a"
        header="A"
        [x]="5"
        [y]="0"
        [width]="200"
        [height]="100"
        [maxWidth]="300"
        [widget]="widget()"
        (dragEnd)="moves.push($event)"
        (resizeEnd)="resizes.push($event)"
        (snapped)="snaps.push($event)"
      />
      <omni-window class="b" header="B" [x]="300" [y]="0" [width]="200" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly allow = signal(true);
  readonly magnetic = signal(false);
  readonly widget = signal(false);
  moves: Rect[] = [];
  resizes: Rect[] = [];
  snaps: (SnapZone | null)[] = [];
}

/** Desktop is 800 × 600. A starts at (5, 0) 200 × 100 (at most 300 wide); B at (300, 0) 200 × 100. */
describe('Window keyboard move, resize and snap', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const a = () => host.windows()[0];
  const handle = () =>
    element.querySelector<HTMLElement>('omni-window.a .omni-window-header, omni-window.a .omni-widget-grip')!;
  const stable = () => fixture.whenStable();

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    setup(host);
    await stable();
    await new Promise((resolve) => setTimeout(resolve));
    await stable();
  }

  async function press(
    key: string,
    modifiers: KeyboardEventInit = {},
    target: HTMLElement = handle()
  ): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    await stable();
    return event;
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  it('makes the title bar a focusable group that describes the keys', async () => {
    await create();
    const header = handle();
    expect(header.tabIndex).toBe(0);
    expect(header.getAttribute('role')).toBe('group');
    expect(header.getAttribute('aria-label')).toBe('A');
    const help = element.querySelector(`#${header.getAttribute('aria-describedby')}`);
    expect(help?.textContent).toContain('Arrow keys move the window');
  });

  describe('moving', () => {
    it('moves 10px per arrow key and 1px with Alt, and reports the move', async () => {
      await create();
      const event = await press('ArrowDown');
      expect(event.defaultPrevented).toBe(true);
      expect(a().rect()).toEqual({ x: 5, y: 10, width: 200, height: 100 });
      await press('ArrowLeft', { altKey: true });
      expect(a().rect()).toEqual({ x: 4, y: 10, width: 200, height: 100 });
      expect(host.moves).toEqual([
        { x: 5, y: 10, width: 200, height: 100 },
        { x: 4, y: 10, width: 200, height: 100 },
      ]);
    });

    it('stays inside the desktop', async () => {
      await create();
      await press('ArrowLeft');
      await press('ArrowUp');
      expect(a().rect()).toMatchObject({ x: 0, y: 0 });
    });

    it('is pulled flush against a window it moves towards, and can step away from it again', async () => {
      await create((h) => h.magnetic.set(true));
      for (let i = 0; i < 8; i++) await press('ArrowRight');
      // 5 → 85 would leave a 15px gap to B (threshold 16): it snaps flush instead.
      expect(a().rect()?.x).toBe(100);
      await press('ArrowLeft');
      expect(a().rect()?.x).toBe(90);
    });

    it('can step away from the desktop edge it is snapped to', async () => {
      await create((h) => h.magnetic.set(true));
      await press('ArrowLeft');
      expect(a().rect()?.x).toBe(0);
      await press('ArrowDown');
      expect(a().rect()).toMatchObject({ x: 0, y: 10 });
    });

    it('stops at a neighbour when overlap is not allowed', async () => {
      await create((h) => h.allow.set(false));
      for (let i = 0; i < 12; i++) await press('ArrowRight');
      expect(a().rect()?.x).toBe(100);
    });

    it('ignores keys meant for the header buttons', async () => {
      await create();
      const close = element.querySelector<HTMLElement>('omni-window.a .omni-window-button')!;
      const event = await press('ArrowDown', {}, close);
      expect(event.defaultPrevented).toBe(false);
      expect(a().rect()?.y).toBe(0);
    });

    it('works from the grip of a widget', async () => {
      await create((h) => h.widget.set(true));
      expect(handle().classList).toContain('omni-widget-grip');
      expect(handle().tabIndex).toBe(0);
      await press('ArrowDown');
      expect(a().rect()?.y).toBe(10);
    });
  });

  describe('resizing', () => {
    it('resizes the right and bottom edges with Shift, and reports it', async () => {
      await create();
      await press('ArrowRight', { shiftKey: true });
      await press('ArrowUp', { shiftKey: true });
      expect(a().rect()).toEqual({ x: 5, y: 0, width: 210, height: 90 });
      expect(host.resizes.at(-1)).toEqual({ x: 5, y: 0, width: 210, height: 90 });
    });

    it('respects the maximum size', async () => {
      await create();
      for (let i = 0; i < 15; i++) await press('ArrowRight', { shiftKey: true });
      expect(a().rect()?.width).toBe(300);
    });

    it('stops at a neighbour when overlap is not allowed', async () => {
      await create((h) => h.allow.set(false));
      for (let i = 0; i < 12; i++) await press('ArrowRight', { shiftKey: true });
      expect(a().rect()?.width).toBe(295);
    });
  });

  describe('snapping', () => {
    it('snaps to the left half with Ctrl+Left and back to its size with Ctrl+Down', async () => {
      await create();
      await press('ArrowLeft', { ctrlKey: true });
      // The left half is the full desktop height, but no wider than maxWidth.
      expect(a().rect()).toMatchObject({ x: 0, y: 0, width: 300 });
      expect(a().rect()!.height).toBeGreaterThan(100);
      expect(host.snaps).toEqual(['left']);

      await press('ArrowDown', { ctrlKey: true });
      expect(a().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(host.snaps).toEqual(['left', null]);
    });

    it('keeps the size from before the first snap when moved from one half to the other', async () => {
      await create();
      await press('ArrowLeft', { ctrlKey: true });
      await press('ArrowRight', { ctrlKey: true });
      expect(host.snaps).toEqual(['left', 'right']);
      await press('ArrowDown', { ctrlKey: true });
      expect(a().rect()).toMatchObject({ width: 200, height: 100 });
    });

    it('maximizes with Ctrl+Up and restores with Ctrl+Down', async () => {
      await create();
      await press('ArrowUp', { ctrlKey: true });
      expect(a().maximized()).toBe(true);
      await press('ArrowDown', { ctrlKey: true });
      expect(a().maximized()).toBe(false);
      expect(a().rect()).toEqual({ x: 5, y: 0, width: 200, height: 100 });
    });

    it('minimizes with Ctrl+Down when not snapped, moving focus to its dock tab', async () => {
      await create();
      handle().focus();
      await press('ArrowDown', { ctrlKey: true });
      expect(a().minimized()).toBe(true);
      expect(document.activeElement?.getAttribute('data-window-id')).toBe(a().id);
    });

    it('moving a snapped window leaves the zone at its current size', async () => {
      await create();
      await press('ArrowLeft', { ctrlKey: true });
      const snapped = a().rect()!;
      await press('ArrowRight');
      expect(a().rect()).toEqual({ ...snapped, x: 10 });
      expect(host.snaps).toEqual(['left', null]);
      await press('ArrowDown', { ctrlKey: true });
      expect(a().minimized()).toBe(true);
    });
  });

  it('announces what a key did once the keys settle', async () => {
    await create();
    const live = element.querySelector('omni-window.a [aria-live="polite"]')!;
    await press('ArrowDown');
    await press('ArrowDown');
    expect(live.textContent?.trim()).toBe('');
    await new Promise((resolve) => setTimeout(resolve, ANNOUNCE_DELAY + 20));
    await stable();
    expect(live.textContent?.trim()).toBe('A moved to 5, 20');

    await press('ArrowLeft', { ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, ANNOUNCE_DELAY + 20));
    await stable();
    expect(live.textContent?.trim()).toBe('A snapped to the left half');
  });
});
