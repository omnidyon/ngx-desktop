import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowContentDirective } from '../../directives/window-slots.directive';
import { DesktopComponent } from '../desktop/desktop.component';
import { CONTENT_DESTROY_DELAY, WindowComponent } from './window.component';

/** Counts how often the lazy content is created and destroyed. */
@Component({
  selector: 'test-lazy',
  template: `<span class="lazy">lazy</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LazyComponent {
  static created = 0;
  static destroyed = 0;
  constructor() {
    LazyComponent.created++;
    inject(DestroyRef).onDestroy(() => LazyComponent.destroyed++);
  }
}

@Component({
  imports: [DesktopComponent, WindowComponent, WindowContentDirective, LazyComponent],
  template: `
    <omni-desktop dock="none">
      <omni-window
        header="R"
        [x]="0"
        [y]="0"
        [width]="width()"
        [height]="100"
        [aspectRatio]="ratio()"
        [(visible)]="visible"
      >
        <ng-template omniWindowContent><test-lazy /></ng-template>
      </omni-window>
      <omni-window header="Other" [x]="500" [y]="400" [width]="200" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly width = signal(200);
  readonly ratio = signal<number | null>(2);
  readonly visible = signal(true);
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Desktop is 800 × 600. R starts at (0, 0), 200 × 100, aspect ratio 2. */
describe('Window aspect ratio and lazy content', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const win = () => host.windows()[0];
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

  async function drag(selector: string, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    pointer(element.querySelector(`omni-window ${selector}`)!, 'pointerdown', from.x, from.y);
    pointer(document, 'pointermove', to.x, to.y);
    pointer(document, 'pointerup', to.x, to.y);
    await stable();
  }

  beforeEach(() => {
    LazyComponent.created = 0;
    LazyComponent.destroyed = 0;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('aspectRatio', () => {
    it('gives the window the shape from the start', async () => {
      await create((h) => h.width.set(300));
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });

    it('keeps the shape when an edge is dragged', async () => {
      await create();
      await drag('.omni-resize-e', { x: 200, y: 50 }, { x: 300, y: 50 });
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });

    it('keeps the shape when a corner is dragged, following the bigger change', async () => {
      await create();
      await drag('.omni-resize-se', { x: 200, y: 100 }, { x: 220, y: 200 });
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    });

    it('takes the largest box of its shape in a zone, and still fills the desktop when maximized', async () => {
      await create();
      await drag('.omni-window-header', { x: 100, y: 10 }, { x: 3, y: 300 });
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 400, height: 200 });

      win().toggleMaximize();
      await stable();
      expect(element.querySelector('omni-window')!.classList).toContain('omni-window-maximized');
    });

    it('keeps the shape on a keyboard resize', async () => {
      await create();
      const header = element.querySelector<HTMLElement>('omni-window .omni-window-header')!;
      header.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
      await stable();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 210, height: 105 });
    });

    it('keeps the shape when tiled', async () => {
      await create();
      (fixture.debugElement.children[0].componentInstance as DesktopComponent).tile('columns');
      await stable();
      // the cell is 400 × 600; the widest 2:1 box is 400 × 200
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    });

    it('allows any shape again when the ratio is removed', async () => {
      await create((h) => h.ratio.set(null));
      await drag('.omni-resize-e', { x: 200, y: 50 }, { x: 300, y: 50 });
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 300, height: 100 });
    });
  });

  describe('omniWindowContent', () => {
    it('is not created while the window is closed, and is created when it opens', async () => {
      await create((h) => h.visible.set(false));
      expect(LazyComponent.created).toBe(0);
      host.visible.set(true);
      await stable();
      expect(LazyComponent.created).toBe(1);
      expect(element.querySelector('.lazy')).not.toBeNull();
    });

    it('is destroyed after minimizing and created again on restore', async () => {
      await create();
      expect(LazyComponent.created).toBe(1);
      win().minimize();
      await stable();
      // still there during the closing animation
      expect(element.querySelector('.lazy')).not.toBeNull();
      await wait(CONTENT_DESTROY_DELAY + 20);
      await stable();
      expect(element.querySelector('.lazy')).toBeNull();
      expect(LazyComponent.destroyed).toBe(1);

      win().restore();
      await stable();
      expect(LazyComponent.created).toBe(2);
      expect(element.querySelector('.lazy')).not.toBeNull();
    });

    it('goes as soon as the closing fade has ended', async () => {
      await create();
      win().close();
      await stable();
      const transitionEnd = new Event('transitionend') as TransitionEvent;
      Object.defineProperty(transitionEnd, 'propertyName', { value: 'opacity' });
      element.querySelector('omni-window')!.dispatchEvent(transitionEnd);
      await stable();
      expect(element.querySelector('.lazy')).toBeNull();
    });

    it('stays when the window comes back before the wait is over', async () => {
      await create();
      win().minimize();
      await stable();
      win().restore();
      await stable();
      await wait(CONTENT_DESTROY_DELAY + 20);
      await stable();
      expect(element.querySelector('.lazy')).not.toBeNull();
      expect(LazyComponent.created).toBe(1);
    });
  });
});
