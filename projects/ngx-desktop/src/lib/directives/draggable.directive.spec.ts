import { ChangeDetectionStrategy, Component, NgZone, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraggableDirective, DragPointerEvent } from './draggable.directive';

/** Moves are emitted once per animation frame. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

@Component({
  imports: [DraggableDirective],
  template: `
    <div
      class="handle"
      [omniDraggable]="enabled()"
      (dragStart)="starts.push($event)"
      (dragMove)="moves.push($event)"
      (dragEnd)="ends.push($event)"
    >
      <button type="button">button</button>
      <span class="inner">text</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly enabled = signal(true);
  starts: DragPointerEvent[] = [];
  moves: DragPointerEvent[] = [];
  ends: DragPointerEvent[] = [];
}

function pointer(target: EventTarget, type: string, x: number, y: number, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: 0,
      ...init,
    })
  );
}

describe('DraggableDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let handle: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    handle = fixture.nativeElement.querySelector('.handle');
  });

  it('reports start, move deltas and end', async () => {
    pointer(handle, 'pointerdown', 10, 20);
    pointer(document, 'pointermove', 15, 30);
    await nextFrame();
    pointer(document, 'pointermove', 40, 5);
    await nextFrame();
    pointer(document, 'pointerup', 50, 0);

    expect(host.starts).toHaveLength(1);
    expect(host.moves.map((m) => [m.dx, m.dy])).toEqual([
      [5, 10],
      [30, -15],
    ]);
    expect(host.ends[0]).toMatchObject({ startX: 10, startY: 20, clientX: 50, clientY: 0, dx: 40, dy: -20 });
  });

  it('emits one move per animation frame, with the latest position', async () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointermove', 1, 1);
    pointer(document, 'pointermove', 2, 2);
    pointer(document, 'pointermove', 3, 4);
    expect(host.moves).toHaveLength(0);
    await nextFrame();
    expect(host.moves.map((m) => [m.dx, m.dy])).toEqual([[3, 4]]);
    pointer(document, 'pointerup', 3, 4);
  });

  it('emits a move still waiting for its frame before the end', () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointermove', 7, 8);
    pointer(document, 'pointerup', 9, 9);
    expect(host.moves.map((m) => [m.dx, m.dy])).toEqual([[7, 8]]);
    expect(host.ends).toHaveLength(1);
  });

  it('drops a pending move when the directive is destroyed mid-drag', async () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointermove', 7, 8);
    fixture.destroy();
    await nextFrame();
    expect(host.moves).toHaveLength(0);
  });

  it('starts from child elements that are not interactive', () => {
    pointer(fixture.nativeElement.querySelector('.inner'), 'pointerdown', 0, 0);
    expect(host.starts).toHaveLength(1);
  });

  it('does not start from buttons inside the handle', () => {
    pointer(fixture.nativeElement.querySelector('button'), 'pointerdown', 0, 0);
    pointer(document, 'pointermove', 10, 10);
    expect(host.starts).toHaveLength(0);
    expect(host.moves).toHaveLength(0);
  });

  it('ignores non-primary buttons', () => {
    pointer(handle, 'pointerdown', 0, 0, { button: 2 });
    expect(host.starts).toHaveLength(0);
  });

  it('ignores other pointers while dragging', () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointermove', 10, 10, { pointerId: 2 });
    pointer(document, 'pointerup', 10, 10, { pointerId: 2 });
    expect(host.moves).toHaveLength(0);
    expect(host.ends).toHaveLength(0);
  });

  it('ends on pointercancel', () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointercancel', 3, 4);
    expect(host.ends).toHaveLength(1);
  });

  it('stops listening after the drag ends', () => {
    pointer(handle, 'pointerdown', 0, 0);
    pointer(document, 'pointerup', 0, 0);
    pointer(document, 'pointermove', 10, 10);
    expect(host.moves).toHaveLength(0);
  });

  it('does nothing when disabled', async () => {
    host.enabled.set(false);
    await fixture.whenStable();
    pointer(handle, 'pointerdown', 0, 0);
    expect(host.starts).toHaveLength(0);
    expect(handle.style.touchAction).toBe('');
  });

  it('disables browser touch gestures on the handle', () => {
    expect(handle.style.touchAction).toBe('none');
  });

  it('removes document listeners when destroyed mid-drag', () => {
    pointer(handle, 'pointerdown', 0, 0);
    fixture.destroy();
    pointer(document, 'pointermove', 10, 10);
    expect(host.moves).toHaveLength(0);
  });
});

/** Records whether code runs inside or outside "Angular's zone" (as zone.js apps would). */
class TrackingZone {
  inside = true;
  run<T>(fn: () => T): T {
    const was = this.inside;
    this.inside = true;
    try {
      return fn();
    } finally {
      this.inside = was;
    }
  }
  runOutsideAngular<T>(fn: () => T): T {
    const was = this.inside;
    this.inside = false;
    try {
      return fn();
    } finally {
      this.inside = was;
    }
  }
}

const trackingZone = new TrackingZone();

@Component({
  imports: [DraggableDirective],
  providers: [{ provide: NgZone, useValue: trackingZone }],
  template: `<div class="handle" omniDraggable (dragMove)="record('move')" (dragEnd)="record('end')"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ZoneHostComponent {
  emits: { event: string; inside: boolean }[] = [];
  record(event: string): void {
    this.emits.push({ event, inside: trackingZone.inside });
  }
}

describe('DraggableDirective and zone.js apps', () => {
  afterEach(() => vi.restoreAllMocks());

  it('follows the pointer outside the zone and emits inside it', async () => {
    const fixture = TestBed.createComponent(ZoneHostComponent);
    await fixture.whenStable();
    const added: { type: string; inside: boolean }[] = [];
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type: string, ...rest: unknown[]) => {
      added.push({ type, inside: trackingZone.inside });
      (add as (...args: unknown[]) => void)(type, ...rest);
    });

    pointer(fixture.nativeElement.querySelector('.handle'), 'pointerdown', 0, 0);
    expect(added.filter((a) => a.type.startsWith('pointer'))).toEqual([
      { type: 'pointermove', inside: false },
      { type: 'pointerup', inside: false },
      { type: 'pointercancel', inside: false },
    ]);

    trackingZone.runOutsideAngular(() => pointer(document, 'pointermove', 5, 5));
    await nextFrame();
    trackingZone.runOutsideAngular(() => pointer(document, 'pointerup', 5, 5));
    expect(fixture.componentInstance.emits).toEqual([
      { event: 'move', inside: true },
      { event: 'end', inside: true },
    ]);
  });
});
