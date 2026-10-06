import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none" [gridSize]="grid()">
      <omni-window header="G" [x]="0" [y]="0" [width]="200" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly grid = signal(20);
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

/** Desktop is 800 × 600; G starts at (0, 0), 200 × 100; grid 20px unless changed. */
describe('Window grid snapping', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const win = () => host.window();
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

  async function drag(selector: string, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    pointer(element.querySelector(`omni-window ${selector}`)!, 'pointerdown', from.x, from.y);
    pointer(document, 'pointermove', to.x, to.y);
    pointer(document, 'pointerup', to.x, to.y);
    await stable();
  }

  async function key(init: KeyboardEventInit): Promise<void> {
    element
      .querySelector('.omni-window-header')!
      .dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    await stable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  it('puts a dragged window on the grid', async () => {
    await create();
    await drag('.omni-window-header', { x: 100, y: 10 }, { x: 137, y: 62 });
    expect(win().rect()).toEqual({ x: 40, y: 60, width: 200, height: 100 });
  });

  it('puts the resized edges on the grid', async () => {
    await create();
    await drag('.omni-resize-se', { x: 200, y: 100 }, { x: 247, y: 133 });
    expect(win().rect()).toEqual({ x: 0, y: 0, width: 240, height: 140 });
  });

  it('moves and resizes one grid cell per arrow key; Alt still moves 1px', async () => {
    await create();
    await key({ key: 'ArrowRight' });
    expect(win().rect()).toMatchObject({ x: 20, y: 0 });
    await key({ key: 'ArrowDown', shiftKey: true });
    expect(win().rect()).toMatchObject({ width: 200, height: 120 });
    await key({ key: 'ArrowRight', altKey: true });
    expect(win().rect()).toMatchObject({ x: 21 });
    // the next full step lands back on the grid
    await key({ key: 'ArrowRight' });
    expect(win().rect()).toMatchObject({ x: 40 });
  });

  it('changes nothing when there is no grid', async () => {
    await create((h) => h.grid.set(0));
    await drag('.omni-window-header', { x: 100, y: 10 }, { x: 137, y: 62 });
    expect(win().rect()).toEqual({ x: 37, y: 52, width: 200, height: 100 });
    await key({ key: 'ArrowRight' });
    expect(win().rect()).toMatchObject({ x: 47 });
  });
});
