import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { WindowLayout } from '../../persistence/window-layout';
import { DesktopComponent } from '../desktop/desktop.component';
import { LAYOUT_SAVE_DELAY, WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      @if (show()) {
        <omni-window
          header="Persisted"
          position="topleft"
          [width]="200"
          [height]="100"
          [persistKey]="key()"
          [(visible)]="visible"
        />
      }
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild(WindowComponent);
  readonly key = signal<string | undefined>('win');
  readonly show = signal(true);
  readonly visible = signal(true);
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

/** Desktop is 800 × 600. */
describe('Window layout persistence', () => {
  let storage: InMemoryLayoutStorage;
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const win = () => host.window()!;
  const element = () => fixture.nativeElement.querySelector('omni-window') as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const afterSaveDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_SAVE_DELAY + 50));
    await fixture.whenStable();
  };

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    setup(host);
    await settle();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    storage = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(storage)] });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('restoring', () => {
    it('uses the initial placement when nothing is saved', async () => {
      await create();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(element().classList).not.toContain('omni-window-measuring');
    });

    it('restores the saved rect and state', async () => {
      await storage.save('win', saved({ maximized: true }));
      await create();
      expect(win().rect()).toEqual({ x: 100, y: 50, width: 300, height: 200 });
      expect(win().maximized()).toBe(true);
    });

    it('restores a closed window as closed and updates the two-way binding', async () => {
      await storage.save('win', saved({ visible: false }));
      await create();
      expect(host.visible()).toBe(false);
      expect(element().classList).toContain('omni-window-away');
    });

    it('restores a minimized window into the dock', async () => {
      await storage.save('win', saved({ minimized: true }));
      await create();
      expect(win().minimized()).toBe(true);
    });

    it('re-fits a snapped zone to the current desktop size', async () => {
      await storage.save(
        'win',
        saved({
          zone: 'right',
          rect: { x: 500, y: 0, width: 500, height: 900 },
          restoreSize: { width: 300, height: 200 },
        })
      );
      await create();
      expect(win().rect()).toEqual({ x: 400, y: 0, width: 400, height: 600 });
    });

    it('keeps a saved rect inside a smaller desktop', async () => {
      await storage.save('win', saved({ rect: { x: 900, y: 700, width: 300, height: 200 } }));
      await create();
      expect(win().rect()).toEqual({ x: 500, y: 400, width: 300, height: 200 });
    });

    it('stays hidden until the saved layout is loaded', async () => {
      let resolveLoad!: (layout: WindowLayout | null) => void;
      vi.spyOn(storage, 'load').mockReturnValue(new Promise((resolve) => (resolveLoad = resolve)));
      await create();
      expect(element().classList).toContain('omni-window-measuring');
      resolveLoad(saved());
      await settle();
      expect(element().classList).not.toContain('omni-window-measuring');
      expect(win().rect()).toEqual(saved().rect);
    });

    it('falls back to the initial placement when loading fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(storage, 'load').mockRejectedValue(new Error('broken'));
      await create();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(element().classList).not.toContain('omni-window-measuring');
    });

    it('ignores layouts of an unknown version', async () => {
      await storage.save('win', { ...saved(), version: 2 } as unknown as WindowLayout);
      await create();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });
  });

  describe('saving', () => {
    it('saves the layout after a drag ends', async () => {
      await create();
      const header = element().querySelector('.omni-window-header')!;
      pointer(header, 'pointerdown', 50, 10);
      pointer(document, 'pointermove', 150, 60);
      pointer(document, 'pointerup', 150, 60);
      await afterSaveDelay();
      expect((await storage.load('win'))?.rect).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    });

    it('does not save in the middle of a drag', async () => {
      await create();
      await afterSaveDelay(); // initial layout saved
      const header = element().querySelector('.omni-window-header')!;
      pointer(header, 'pointerdown', 50, 10);
      pointer(document, 'pointermove', 150, 60);
      await afterSaveDelay();
      expect((await storage.load('win'))?.rect).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      pointer(document, 'pointerup', 150, 60);
    });

    it('saves the snapped zone and the size to restore', async () => {
      await create();
      const header = element().querySelector('.omni-window-header')!;
      pointer(header, 'pointerdown', 50, 10);
      pointer(document, 'pointermove', 795, 300);
      await fixture.whenStable();
      pointer(document, 'pointerup', 795, 300);
      await afterSaveDelay();
      const layout = await storage.load('win');
      expect(layout?.zone).toBe('right');
      expect(layout?.restoreSize).toEqual({ width: 200, height: 100 });
    });

    it('saves minimized, maximized and visible', async () => {
      await create();
      win().toggleMaximize();
      await afterSaveDelay();
      expect((await storage.load('win'))?.maximized).toBe(true);
      win().toggleMinimize();
      await afterSaveDelay();
      expect(await storage.load('win')).toMatchObject({ minimized: true, maximized: false });
      win().close();
      await afterSaveDelay();
      expect((await storage.load('win'))?.visible).toBe(false);
    });

    it('debounces rapid changes into one save', async () => {
      await create();
      await afterSaveDelay();
      const save = vi.spyOn(storage, 'save');
      win().rect.set({ x: 10, y: 10, width: 200, height: 100 });
      await fixture.whenStable();
      win().rect.set({ x: 20, y: 20, width: 200, height: 100 });
      await fixture.whenStable();
      await afterSaveDelay();
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][1].rect).toEqual({ x: 20, y: 20, width: 200, height: 100 });
    });

    it('writes a pending save immediately when the window is destroyed', async () => {
      await create();
      await afterSaveDelay();
      win().rect.set({ x: 42, y: 42, width: 200, height: 100 });
      await fixture.whenStable();
      host.show.set(false);
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      expect((await storage.load('win'))?.rect).toEqual({ x: 42, y: 42, width: 200, height: 100 });
    });

    it('saves nothing without a persistKey', async () => {
      const save = vi.spyOn(storage, 'save');
      await create((h) => h.key.set(undefined));
      win().toggleMaximize();
      await afterSaveDelay();
      expect(save).not.toHaveBeenCalled();
    });

    it('keeps working when saving fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(storage, 'save').mockRejectedValue(new Error('quota'));
      await create();
      await afterSaveDelay();
      expect(warn).toHaveBeenCalled();
      expect(win().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });
  });

  it('forgetLayout() removes the saved layout', async () => {
    await create();
    await afterSaveDelay();
    expect(await storage.load('win')).not.toBeNull();
    await win().forgetLayout();
    expect(await storage.load('win')).toBeNull();
  });
});
