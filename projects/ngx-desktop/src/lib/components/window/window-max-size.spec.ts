import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Length } from '../../geometry/length';
import { Rect } from '../../models/types';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { WindowLayout } from '../../persistence/window-layout';
import { DesktopService } from '../../services/desktop.service';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      <omni-window
        header="W"
        position="topleft"
        persistKey="w"
        [width]="width()"
        [height]="100"
        [maxWidth]="maxWidth()"
        [maxHeight]="maxHeight()"
        [(rect)]="rect"
      />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly width = signal<Length>(200);
  readonly maxWidth = signal<Length | undefined>(300);
  readonly maxHeight = signal<Length | undefined>(200);
  readonly rect = signal<Rect | null>(null);
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

/** Desktop is 800 × 600; the window starts at (0, 0), 200 × 100, at most 300 × 200. */
describe('Window maximum size', () => {
  let storage: InMemoryLayoutStorage;
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let width = 800;

  const win = () => host.window();
  const element = () => fixture.nativeElement.querySelector('omni-window') as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    setup(host);
    await settle();
  }

  async function drag(selector: string, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    pointer(element().querySelector(selector)!, 'pointerdown', from.x, from.y);
    pointer(document, 'pointermove', to.x, to.y);
    await fixture.whenStable();
    pointer(document, 'pointerup', to.x, to.y);
    await fixture.whenStable();
  }

  beforeEach(() => {
    width = 800;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    storage = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(storage)] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts no larger than the maximum', async () => {
    await create((h) => h.width.set(500));
    expect(win().rect()).toMatchObject({ width: 300, height: 100 });
  });

  it('stops resizing at the maximum', async () => {
    await create();
    await drag('.omni-resize-se', { x: 200, y: 100 }, { x: 600, y: 500 });
    expect(win().rect()).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('accepts percentages of the desktop', async () => {
    await create((h) => {
      h.maxWidth.set('50%');
      h.maxHeight.set(undefined);
    });
    // no height limit; the bottom edge stops well clear of the desktop edge (no magnetic snap)
    await drag('.omni-resize-se', { x: 200, y: 100 }, { x: 790, y: 500 });
    expect(win().rect()).toEqual({ x: 0, y: 0, width: 400, height: 500 });
  });

  it('keeps the left side of the left-half zone, at its maximum size', async () => {
    await create();
    await drag('.omni-window-header', { x: 100, y: 10 }, { x: 3, y: 300 });
    expect(win().rect()).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('keeps the right side of the right-half zone, at its maximum size', async () => {
    await create();
    await drag('.omni-window-header', { x: 100, y: 10 }, { x: 797, y: 300 });
    expect(win().rect()).toEqual({ x: 500, y: 0, width: 300, height: 200 });
  });

  it('keeps a bottom-right quarter in its corner', async () => {
    await create();
    await drag('.omni-window-header', { x: 100, y: 10 }, { x: 797, y: 597 });
    expect(win().rect()).toEqual({ x: 500, y: 400, width: 300, height: 200 });
  });

  it('still fills the desktop when maximized', async () => {
    await create();
    win().toggleMaximize();
    await fixture.whenStable();
    expect(element().classList).toContain('omni-window-maximized');
  });

  it('limits a rect set from code', async () => {
    await create();
    host.rect.set({ x: 10, y: 10, width: 700, height: 500 });
    await fixture.whenStable();
    expect(win().rect()).toEqual({ x: 10, y: 10, width: 300, height: 200 });
  });

  it('limits a restored layout', async () => {
    const saved: WindowLayout = {
      version: 1,
      rect: { x: 50, y: 50, width: 700, height: 500 },
      zone: null,
      restoreSize: null,
      minimized: false,
      maximized: false,
      visible: true,
    };
    await storage.save('w', saved);
    await create();
    expect(win().rect()).toEqual({ x: 50, y: 50, width: 300, height: 200 });
  });

  it('follows a percentage maximum when the desktop gets smaller', async () => {
    await create((h) => h.maxWidth.set('50%'));
    expect(win().rect()?.width).toBe(200);
    width = 300; // 50% is now 150
    fixture.debugElement.query(By.directive(DesktopComponent)).injector.get(DesktopService).updateSize();
    await settle();
    expect(win().rect()?.width).toBe(150);
  });
});
