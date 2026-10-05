import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Length } from '../../geometry/length';
import { Rect, WindowPosition } from '../../models/types';
import { WindowComponent } from './window.component';

/** Moves are emitted once per animation frame. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

@Component({
  imports: [WindowComponent],
  template: `
    <omni-window
      header="Positioned"
      [position]="position()"
      [x]="x()"
      [y]="y()"
      [width]="width()"
      [height]="height()"
      [keepInBounds]="keepInBounds()"
      [(rect)]="rect"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly position = signal<WindowPosition>('center');
  readonly x = signal<Length | undefined>(undefined);
  readonly y = signal<Length | undefined>(undefined);
  readonly width = signal<Length | undefined>(200);
  readonly height = signal<Length | undefined>(100);
  readonly keepInBounds = signal(true);
  readonly rect = signal<Rect | null>(null);
}

/** Standalone windows are placed in the viewport, which jsdom reports as 1024 × 768. */
describe('Window positioning', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    setup(host);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  it('uses x/y in px instead of the named position', async () => {
    await create((h) => {
      h.x.set(120);
      h.y.set('40px');
    });
    expect(host.window().rect()).toEqual({ x: 120, y: 40, width: 200, height: 100 });
  });

  it('resolves percentages against the viewport', async () => {
    await create((h) => {
      h.x.set('25%');
      h.y.set('50%');
      h.width.set('50%');
      h.height.set('25%');
    });
    expect(host.window().rect()).toEqual({ x: 256, y: 384, width: 512, height: 192 });
  });

  it('uses the named position on an axis without x/y', async () => {
    await create((h) => h.x.set(10));
    // centered vertically: (768 - 100) / 2
    expect(host.window().rect()).toEqual({ x: 10, y: 334, width: 200, height: 100 });
  });

  it('keeps an explicit position inside the viewport unless keepInBounds is off', async () => {
    await create((h) => h.x.set(2000));
    expect(host.window().rect()?.x).toBe(1024 - 200);

    await create((h) => {
      h.x.set(2000);
      h.keepInBounds.set(false);
    });
    expect(host.window().rect()?.x).toBe(2000);
  });

  it('prefers an initial [rect] over x/y and position', async () => {
    await create((h) => {
      h.x.set(10);
      h.rect.set({ x: 300, y: 200, width: 250, height: 150 });
    });
    expect(host.window().rect()).toEqual({ x: 300, y: 200, width: 250, height: 150 });
  });

  it('reports its rect to the two-way binding once placed', async () => {
    await create((h) => h.position.set('topleft'));
    expect(host.rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('moves and resizes when the bound rect is set from outside', async () => {
    await create();
    host.rect.set({ x: 50, y: 60, width: 300, height: 200 });
    await fixture.whenStable();
    const element = fixture.nativeElement.querySelector('omni-window') as HTMLElement;
    expect(element.style.transform).toBe('translate3d(50px, 60px, 0)');
    expect(element.style.width).toBe('300px');
  });

  it('keeps a rect set from outside inside the viewport', async () => {
    await create();
    host.rect.set({ x: 5000, y: -50, width: 300, height: 200 });
    await fixture.whenStable();
    expect(host.window().rect()).toEqual({ x: 724, y: 0, width: 300, height: 200 });
    expect(host.rect()).toEqual({ x: 724, y: 0, width: 300, height: 200 });
  });

  it('updates the bound rect while dragging', async () => {
    await create((h) => h.position.set('topleft'));
    const header = fixture.nativeElement.querySelector('.omni-window-header') as HTMLElement;
    const pointer = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
    pointer(header, 'pointerdown', 50, 10);
    pointer(document, 'pointermove', 80, 30);
    await nextFrame();
    await fixture.whenStable();
    expect(host.rect()).toEqual({ x: 30, y: 20, width: 200, height: 100 });
    pointer(document, 'pointerup', 80, 30);
  });
});
