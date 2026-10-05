import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { WindowLayout } from '../../persistence/window-layout';
import { DesktopService } from '../../services/desktop.service';
import { DesktopComponent } from '../desktop/desktop.component';
import { LAYOUT_SAVE_DELAY, WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      <omni-window header="W" position="topleft" [width]="200" [height]="100" persistKey="win" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
}

const saved = (patch: Partial<WindowLayout> = {}): WindowLayout => ({
  version: 1,
  rect: { x: 100, y: 50, width: 300, height: 200 },
  zone: null,
  restoreSize: null,
  minimized: false,
  maximized: false,
  visible: true,
  ...patch,
});

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
}

/** Findings from the audit: hidden desktops, stored data, double-clicks and interrupted resizes. */
describe('Window edge cases', () => {
  let storage: InMemoryLayoutStorage;
  let fixture: ComponentFixture<HostComponent>;
  let width = 800;
  let height = 600;

  const win = () => fixture.componentInstance.window();
  const element = () => fixture.nativeElement.querySelector('omni-window') as HTMLElement;
  const service = () => fixture.debugElement.query(By.directive(DesktopComponent)).injector.get(DesktopService);
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const afterSaveDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_SAVE_DELAY + 50));
    await fixture.whenStable();
  };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  }

  beforeEach(() => {
    width = 800;
    height = 600;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
    storage = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(storage)] });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('hidden desktop', () => {
    it('keeps window sizes, and saves no 0 × 0 layout, while the desktop is hidden', async () => {
      await create();
      win().rect.set({ x: 300, y: 200, width: 200, height: 100 });
      await afterSaveDelay();

      width = 0;
      height = 0;
      service().updateSize();
      await afterSaveDelay();

      expect(service().size()).toEqual({ width: 800, height: 600 });
      expect(win().rect()).toEqual({ x: 300, y: 200, width: 200, height: 100 });
      expect((await storage.load('win'))?.rect).toEqual({ x: 300, y: 200, width: 200, height: 100 });
    });

    it('places a window created while the desktop is hidden once it is shown', async () => {
      width = 0;
      height = 0;
      await create();
      expect(element().classList).toContain('omni-window-measuring');
      expect(win().rect()).toBeNull();

      width = 800;
      height = 600;
      service().updateSize();
      await settle();

      expect(element().classList).not.toContain('omni-window-measuring');
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });
  });

  describe('restoring stored layouts', () => {
    it('raises a stored size below the minimum to the minimum', async () => {
      await storage.save('win', saved({ rect: { x: 10, y: 10, width: 40, height: 20 } }));
      await create();
      expect(win().rect()).toEqual({ x: 10, y: 10, width: 130, height: 65 });
    });

    it.each([
      ['a 0 × 0 rect', { rect: { x: 0, y: 0, width: 0, height: 0 } }],
      ['a NaN coordinate', { rect: { x: Number.NaN, y: 0, width: 300, height: 200 } }],
      ['an unknown zone', { zone: 'middle' }],
      ['a missing flag', { visible: undefined }],
    ])('ignores a layout with %s', async (_name, patch) => {
      await storage.save('win', { ...saved(), ...patch } as unknown as WindowLayout);
      await create();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });

    it('restores the size to go back to for a window that only partly fitted its zone', async () => {
      await storage.save(
        'win',
        saved({ rect: { x: 0, y: 0, width: 400, height: 600 }, restoreSize: { width: 300, height: 200 } })
      );
      await create();
      const header = element().querySelector('.omni-window-header')!;
      pointer(header, 'pointerdown', 200, 10);
      pointer(document, 'pointermove', 300, 110);
      pointer(document, 'pointerup', 300, 110);
      await fixture.whenStable();
      expect(win().rect()).toMatchObject({ width: 300, height: 200 });
    });
  });

  describe('double-click on the header', () => {
    it('does not maximize when a header button is double-clicked', async () => {
      await create();
      for (const label of ['Close', 'Minimize', 'Full screen']) {
        const button = element().querySelector(`.omni-window-button[aria-label="${label}"]`)!;
        button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }
      await fixture.whenStable();
      expect(win().maximized()).toBe(false);
    });

    it('still maximizes when the title is double-clicked', async () => {
      await create();
      element()
        .querySelector('.omni-window-title')!
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await fixture.whenStable();
      expect(win().maximized()).toBe(true);
    });
  });

  it('ends a resize whose handles disappear, so saving resumes', async () => {
    await create();
    const resizeEnd = vi.fn();
    win().resizeEnd.subscribe(resizeEnd);
    pointer(element().querySelector('.omni-resize-se')!, 'pointerdown', 200, 100);
    pointer(document, 'pointermove', 260, 140);
    await fixture.whenStable();
    expect(element().classList).toContain('omni-window-interacting');

    win().maximized.set(true); // removes the resize handles mid-resize
    await fixture.whenStable();
    expect(element().classList).not.toContain('omni-window-interacting');
    expect(resizeEnd).toHaveBeenCalled();

    await afterSaveDelay();
    expect((await storage.load('win'))?.maximized).toBe(true);
  });
});
