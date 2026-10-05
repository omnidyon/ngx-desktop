import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { Rect } from '../../models/types';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { DesktopService } from '../../services/desktop.service';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none" [allowOverlap]="allow()">
      <omni-window
        class="first"
        header="First"
        position="topleft"
        [width]="200"
        [height]="100"
        persistKey="first"
        [(rect)]="firstRect"
      />
      @if (added()) {
        <omni-window class="added" header="Added" position="bottomright" [width]="300" [height]="200" />
      }
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly added = signal(false);
  readonly allow = signal(true);
  readonly firstRect = signal<Rect | null>(null);
}

/** Windows that are opened while their desktop is hidden (another tab, a collapsed panel, display: none). */
describe('Windows opened while the desktop is hidden', () => {
  let fixture: ComponentFixture<HostComponent>;
  let storage: InMemoryLayoutStorage;
  let host: HostComponent;
  let width = 800;
  let height = 600;

  const service = () => fixture.debugElement.query(By.directive(DesktopComponent)).injector.get(DesktopService);
  const added = () => host.windows().find((w) => w.header() === 'Added')!;
  const addedElement = () => fixture.nativeElement.querySelector('omni-window.added') as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  /** Changes the measured desktop size and lets the desktop notice, like its ResizeObserver would. */
  const measure = async (w: number, h: number) => {
    width = w;
    height = h;
    service().updateSize();
    await settle();
  };

  beforeEach(async () => {
    width = 800;
    height = 600;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
    storage = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(storage)] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => vi.restoreAllMocks());

  it('places the window when a previously visible desktop is shown again at the same size', async () => {
    await measure(0, 0); // hidden
    host.added.set(true);
    await settle();
    expect(addedElement().classList).toContain('omni-window-measuring');

    await measure(800, 600); // shown again, same size as before
    expect(addedElement().classList).not.toContain('omni-window-measuring');
    expect(added().rect()).toEqual({ x: 500, y: 400, width: 300, height: 200 });
  });

  it('places the window for the new size when the desktop comes back at a different size', async () => {
    await measure(0, 0);
    host.added.set(true);
    await settle();

    await measure(1000, 700);
    expect(added().rect()).toEqual({ x: 700, y: 500, width: 300, height: 200 });
  });

  it('places a window right away in a visible desktop that is smaller than its minimum size', async () => {
    await measure(100, 50);
    host.added.set(true);
    await settle();
    expect(addedElement().classList).not.toContain('omni-window-measuring');
    expect(added().rect()).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  describe('changes made from code while the desktop is hidden', () => {
    const first = () => host.windows().find((w) => w.header() === 'First')!;
    const afterSaveDelay = () => new Promise((resolve) => setTimeout(resolve, 400));

    it('keeps a rect set through [(rect)] as given, and fits it once the desktop is shown again', async () => {
      await measure(0, 0);
      host.firstRect.set({ x: 600, y: 450, width: 300, height: 200 });
      await settle();
      expect(first().rect()).toEqual({ x: 600, y: 450, width: 300, height: 200 });
      await afterSaveDelay();
      expect((await storage.load('first'))?.rect).toEqual({ x: 600, y: 450, width: 300, height: 200 });

      await measure(700, 500); // shown again, smaller than the rect needs
      expect(first().rect()).toEqual({ x: 400, y: 300, width: 300, height: 200 });
    });

    it('fits a rect set while hidden even when the desktop comes back at the same size', async () => {
      await measure(0, 0);
      host.firstRect.set({ x: 900, y: 0, width: 200, height: 100 });
      await settle();
      await measure(800, 600);
      expect(first().rect()).toEqual({ x: 600, y: 0, width: 200, height: 100 });
    });

    it('restores a window without overlap checks against the 0 × 0 size', async () => {
      host.allow.set(false);
      await settle();
      first().toggleMinimize();
      await settle();
      await measure(0, 0);
      first().restore();
      await settle();
      expect(first().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      await afterSaveDelay();
      expect((await storage.load('first'))?.rect).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });
  });

  it('keeps already placed windows unchanged while hidden', async () => {
    const before = host.windows()[0].rect();
    await measure(0, 0);
    expect(host.windows()[0].rect()).toEqual(before);
  });
});
