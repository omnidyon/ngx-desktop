import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DesktopService } from '../../services/desktop.service';
import { DesktopComponent } from '../desktop/desktop.component';
import { SnapZone } from '../../models/types';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [snapToZones]="zones()" [snapToWindows]="magnetic()" dock="none">
      <omni-window
        class="a"
        header="A"
        position="topleft"
        [width]="200"
        [height]="100"
        [snappable]="snappable()"
        (snapped)="snaps.push($event)"
      />
      <omni-window class="b" header="B" position="center" [width]="200" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly zones = signal(true);
  readonly magnetic = signal(true);
  readonly snappable = signal(true);
  snaps: (SnapZone | null)[] = [];
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

/**
 * Desktop is 800 × 600 at the viewport origin, so client and desktop coordinates are equal.
 * A starts at (0, 0) 200 × 100; B is centered at (300, 250) 200 × 100.
 */
describe('Window snapping inside a desktop', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const a = () => host.windows()[0];
  const header = (selector = '.a') => element.querySelector<HTMLElement>(`${selector} .omni-window-header`)!;
  const preview = () => element.querySelector<HTMLElement>('.omni-snap-preview');
  const stable = () => fixture.whenStable();

  /** Drags the header of A from (100, 10) to (x, y). */
  async function dragA(x: number, y: number, from = { x: 100, y: 10 }): Promise<void> {
    pointer(header(), 'pointerdown', from.x, from.y);
    pointer(document, 'pointermove', x, y);
    await stable();
    pointer(document, 'pointerup', x, y);
    await stable();
  }

  beforeEach(async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await stable();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('zones', () => {
    it('shows a preview while the pointer is at an edge', async () => {
      pointer(header(), 'pointerdown', 100, 10);
      pointer(document, 'pointermove', 5, 300);
      await stable();
      const shown = preview();
      expect(shown).not.toBeNull();
      expect(shown!.style.width).toBe('400px');
      expect(shown!.style.height).toBe('600px');
      expect(shown!.style.zIndex).toBe(element.querySelector<HTMLElement>('.a')!.style.zIndex);

      pointer(document, 'pointermove', 300, 300);
      await stable();
      expect(preview()).toBeNull();
      pointer(document, 'pointerup', 300, 300);
    });

    it('snaps to the left half on release and removes the preview', async () => {
      await dragA(5, 300);
      expect(a().rect()).toEqual({ x: 0, y: 0, width: 400, height: 600 });
      expect(host.snaps).toEqual(['left']);
      expect(preview()).toBeNull();
    });

    it('snaps to a quarter in a corner', async () => {
      await dragA(795, 595);
      expect(a().rect()).toEqual({ x: 400, y: 300, width: 400, height: 300 });
      expect(host.snaps).toEqual(['bottomright']);
    });

    it('maximizes at the top edge and keeps the pre-drag rect for restoring', async () => {
      await dragA(400, 2);
      expect(a().maximized()).toBe(true);
      expect(a().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(host.snaps).toEqual(['maximize']);
    });

    it('restores the previous size when a snapped window is dragged out', async () => {
      await dragA(5, 300);
      // Grab the snapped window in the middle of its header (50% of 400px) and drag it away.
      await dragA(300, 200, { x: 200, y: 10 });
      // Same 50% point of the restored 200px width stays under the pointer.
      expect(a().rect()).toEqual({ x: 200, y: 190, width: 200, height: 100 });
      expect(host.snaps).toEqual(['left', null]);
    });

    it('stays snapped when the header is only clicked', async () => {
      await dragA(5, 300);
      pointer(header(), 'pointerdown', 200, 10);
      pointer(document, 'pointerup', 200, 10);
      await stable();
      expect(a().rect()).toEqual({ x: 0, y: 0, width: 400, height: 600 });
      expect(host.snaps).toEqual(['left']);
    });

    it('keeps the snapped size after a manual resize', async () => {
      await dragA(5, 300);
      const handle = element.querySelector('.a .omni-resize-e')!;
      pointer(handle, 'pointerdown', 400, 300);
      pointer(document, 'pointermove', 350, 300);
      pointer(document, 'pointerup', 350, 300);
      await stable();
      await dragA(500, 200, { x: 100, y: 10 });
      expect(a().rect()).toMatchObject({ width: 350, height: 600 });
    });

    it('does not snap to zones when snapToZones is off', async () => {
      host.zones.set(false);
      await stable();
      await dragA(5, 300);
      expect(preview()).toBeNull();
      expect(a().rect()).toMatchObject({ width: 200, height: 100 });
      expect(host.snaps).toEqual([]);
    });
  });

  describe('desktop resize', () => {
    let width = 800;
    let height = 600;

    async function resizeDesktop(w: number, h: number): Promise<void> {
      width = w;
      height = h;
      fixture.debugElement.query(By.directive(DesktopComponent)).injector.get(DesktopService).updateSize();
      await stable();
    }

    beforeEach(() => {
      width = 800;
      height = 600;
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
    });

    it('keeps a snapped window in its zone', async () => {
      await dragA(795, 595);
      await resizeDesktop(1000, 500);
      expect(a().rect()).toEqual({ x: 500, y: 250, width: 500, height: 250 });
    });

    it('keeps other windows inside the smaller desktop', async () => {
      await resizeDesktop(400, 300);
      expect(host.windows()[1].rect()).toEqual({ x: 200, y: 200, width: 200, height: 100 });
    });

    it('stops following the zone once the window is dragged out', async () => {
      await dragA(5, 300);
      await dragA(300, 200, { x: 200, y: 10 });
      await resizeDesktop(1000, 600);
      expect(a().rect()).toEqual({ x: 200, y: 190, width: 200, height: 100 });
    });
  });

  describe('magnetic edges', () => {
    it('lines a moved window up flush with a neighbour', async () => {
      // Without snapping A would land at (90, 260): right edge 10px left of B, top 10px below B's top.
      await dragA(190, 270);
      expect(a().rect()).toEqual({ x: 100, y: 250, width: 200, height: 100 });
    });

    it('does not line windows up when snapToWindows is off', async () => {
      host.magnetic.set(false);
      await stable();
      await dragA(190, 270);
      expect(a().rect()).toEqual({ x: 90, y: 260, width: 200, height: 100 });
    });

    it('snaps a resized edge to the desktop edge', async () => {
      const handle = element.querySelector('.a .omni-resize-e')!;
      pointer(handle, 'pointerdown', 200, 50);
      pointer(document, 'pointermove', 788, 50);
      pointer(document, 'pointerup', 788, 50);
      await stable();
      expect(a().rect()).toMatchObject({ x: 0, width: 800 });
    });
  });

  it('ignores windows that are not snappable', async () => {
    host.snappable.set(false);
    await stable();
    // Plain move by (-95, 290), clamped to the desktop: no zone.
    await dragA(5, 300);
    expect(preview()).toBeNull();
    expect(a().rect()).toEqual({ x: 0, y: 290, width: 200, height: 100 });
    expect(host.snaps).toEqual([]);
  });

  it('ignores windows that are not snappable for magnetic edges', async () => {
    host.snappable.set(false);
    await stable();
    await dragA(190, 270);
    expect(a().rect()).toEqual({ x: 90, y: 260, width: 200, height: 100 });
  });
});
