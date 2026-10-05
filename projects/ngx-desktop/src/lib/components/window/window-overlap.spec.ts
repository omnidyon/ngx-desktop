import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Rect, SnapZone } from '../../models/types';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

/** Moves are emitted once per animation frame. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [allowOverlap]="allow()" [snapPadding]="padding()" dock="none">
      <omni-window
        class="a"
        header="A"
        position="topleft"
        [width]="200"
        [height]="100"
        (snapped)="snaps.push($event)"
      />
      <omni-window class="b" header="B" [x]="bx()" [y]="by()" [width]="200" [height]="100" [(rect)]="bRect" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly allow = signal(false);
  readonly padding = signal(0);
  readonly bx = signal(300);
  readonly by = signal(250);
  readonly bRect = signal<Rect | null>(null);
  snaps: (SnapZone | null)[] = [];
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

/** Desktop is 800 × 600. A starts at (0, 0) 200 × 100; B at (300, 250) 200 × 100 unless changed. */
describe('Window placement without overlap', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const a = () => host.windows()[0];
  const b = () => host.windows()[1];
  const preview = () => element.querySelector<HTMLElement>('.omni-snap-preview');
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

  /** Drags a window's header by (dx, dy), checking `during` before releasing. */
  async function drag(selector: string, dx: number, dy: number, during?: () => void): Promise<void> {
    const header = element.querySelector(`${selector} .omni-window-header`)!;
    pointer(header, 'pointerdown', 100, 10);
    pointer(document, 'pointermove', 100 + dx, 10 + dy);
    await nextFrame();
    await stable();
    during?.();
    pointer(document, 'pointerup', 100 + dx, 10 + dy);
    await stable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('dragging', () => {
    it('lands flush beside the window it was dropped on, previewing the spot first', async () => {
      await create();
      // Dropped at (230, 280): overlaps B; the closest free spot of the same size is just below B.
      await drag('.a', 230, 280, () => {
        expect(preview()?.style.transform).toBe('translate3d(230px, 350px, 0)');
        expect(a().rect()).toMatchObject({ x: 230, y: 280 }); // still follows the pointer while dragging
      });
      expect(a().rect()).toEqual({ x: 230, y: 350, width: 200, height: 100 });
      expect(preview()).toBeNull();
      expect(b().rect()).toEqual({ x: 300, y: 250, width: 200, height: 100 }); // B never moves
    });

    it('keeps snapPadding as the gap between windows', async () => {
      await create((h) => h.padding.set(10));
      await drag('.a', 230, 280);
      expect(a().rect()).toEqual({ x: 230, y: 360, width: 200, height: 100 });
    });

    it('shows no preview when the drop spot is free', async () => {
      await create();
      await drag('.a', 20, 400, () => expect(preview()).toBeNull());
      expect(a().rect()).toMatchObject({ x: 20, y: 400 });
    });

    it('lets windows overlap when allowOverlap is on', async () => {
      await create((h) => h.allow.set(true));
      await drag('.a', 230, 280);
      expect(a().rect()).toEqual({ x: 230, y: 280, width: 200, height: 100 });
    });
  });

  describe('snapping', () => {
    it('moves a zone snap aside when the zone is partly taken, and does not count it as snapped', async () => {
      await create((h) => h.bx.set(500));
      // Right half would be (400, 0, 400, 600) but B sits at x 500..700: the half-size window shifts left.
      await drag('.a', 699, 290);
      expect(a().rect()).toEqual({ x: 100, y: 0, width: 400, height: 600 });
      expect(host.snaps).toEqual([null]);
    });

    it('snaps normally when the zone is free', async () => {
      await create((h) => {
        h.bx.set(10);
        h.by.set(500);
      });
      await drag('.a', 699, 290);
      expect(a().rect()).toEqual({ x: 400, y: 0, width: 400, height: 600 });
      expect(host.snaps).toEqual(['right']);
    });

    it('still maximizes at the top edge', async () => {
      await create();
      await drag('.a', 300, -8);
      expect(a().maximized()).toBe(true);
    });
  });

  describe('resizing', () => {
    it('stops the edge being dragged at the neighbouring window', async () => {
      await create((h) => h.by.set(50));
      const handle = element.querySelector('.a .omni-resize-e')!;
      pointer(handle, 'pointerdown', 200, 50);
      pointer(document, 'pointermove', 600, 50);
      pointer(document, 'pointerup', 600, 50);
      await stable();
      expect(a().rect()).toEqual({ x: 0, y: 0, width: 300, height: 100 });
    });
  });

  describe('opening and restoring', () => {
    it('fits a window that opens on top of another', async () => {
      await create((h) => {
        h.bx.set(100);
        h.by.set(50);
      });
      expect(b().rect()).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    });

    it('fits a window restored from the dock into free space', async () => {
      await create();
      a().toggleMinimize();
      await stable();
      host.bRect.set({ x: 0, y: 0, width: 200, height: 100 }); // B takes A's place while A is in the dock
      await stable();
      a().restore();
      await stable();
      expect(a().rect()).toEqual({ x: 0, y: 100, width: 200, height: 100 });
    });

    it('fits a rect set from code', async () => {
      await create();
      host.bRect.set({ x: 50, y: 20, width: 200, height: 100 });
      await stable();
      expect(b().rect()).toEqual({ x: 50, y: 100, width: 200, height: 100 });
    });
  });
});
