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
      <omni-window header="R" [x]="0" [y]="0" [width]="width()" [height]="100" [(visible)]="visible">
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
  readonly visible = signal(true);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Desktop is 800 × 600. R starts at (0, 0), 200 × 100. */
describe('Window content only while shown', () => {
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

  beforeEach(() => {
    LazyComponent.created = 0;
    LazyComponent.destroyed = 0;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

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
