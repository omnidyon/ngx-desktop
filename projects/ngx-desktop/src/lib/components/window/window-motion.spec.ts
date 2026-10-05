import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DesktopMotion, provideDesktopConfig } from '../../config/desktop-config';
import { DockPosition } from '../../models/types';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { DesktopComponent } from '../desktop/desktop.component';
import { DialogComponent } from '../dialog/dialog.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent, DialogComponent],
  template: `
    <omni-desktop [dock]="dock()">
      <omni-window header="W" position="topleft" [width]="200" [height]="100" />
    </omni-desktop>
    <omni-dialog header="D" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly dock = signal<DockPosition>('bottom');
}

/** Desktop 800 × 600; the dock tab of the window is mocked at (400, 560), 40 × 40. */
describe('Window motion', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
  const stable = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  async function create(motion?: DesktopMotion): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideDesktopLayoutStorage(new InMemoryLayoutStorage()),
        ...(motion ? [provideDesktopConfig({ motion })] : []),
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await stable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('omni-dock-tab')) return { left: 400, top: 560, width: 40, height: 40 } as DOMRect;
      return original.call(this);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('motion setting', () => {
    it.each([
      [undefined, 'omni-motion-system'],
      ['full', 'omni-motion-full'],
      ['none', 'omni-motion-none'],
    ] as const)('motion %s marks windows, the desktop and dialogs with %s', async (motion, cssClass) => {
      await create(motion);
      for (const selector of ['omni-window', 'omni-desktop', 'omni-dialog']) {
        const classes = element(selector).classList;
        expect(classes).toContain(cssClass);
        expect(
          ['omni-motion-system', 'omni-motion-full', 'omni-motion-none'].filter((c) => classes.contains(c))
        ).toEqual([cssClass]);
      }
    });
  });

  it("scales around the window's own centre", async () => {
    await create();
    expect(element('omni-window').style.transformOrigin).toBe('100px 50px');
    host.window().rect.set({ x: 300, y: 200, width: 200, height: 100 });
    await stable();
    expect(element('omni-window').style.transformOrigin).toBe('400px 250px');
  });

  describe('minimizing into the dock tab', () => {
    it('flies from its centre to the centre of its dock tab, shrinking to the tab size', async () => {
      await create();
      host.window().toggleMinimize();
      await stable();
      const window = element('omni-window');
      expect(window.classList).toContain('omni-window-to-dock');
      // window centre (100, 50) → tab centre (420, 580); 200 × 100 → 40 × 40
      expect(window.style.getPropertyValue('--omni-dock-dx')).toBe('320px');
      expect(window.style.getPropertyValue('--omni-dock-dy')).toBe('530px');
      expect(window.style.getPropertyValue('--omni-dock-sx')).toBe('0.2');
      expect(window.style.getPropertyValue('--omni-dock-sy')).toBe('0.4');
    });

    it('grows back out of the tab when restored', async () => {
      await create();
      host.window().toggleMinimize();
      await stable();
      host.window().restore();
      await stable();
      const window = element('omni-window');
      expect(window.classList).not.toContain('omni-window-to-dock');
      expect(window.classList).not.toContain('omni-window-away');
    });

    it('fades in place when there is no dock', async () => {
      await create();
      host.dock.set('none');
      await stable();
      host.window().toggleMinimize();
      await stable();
      expect(element('omni-window').classList).not.toContain('omni-window-to-dock');
      expect(element('omni-window').classList).toContain('omni-window-away');
    });

    it('does not fly to the dock when closed', async () => {
      await create();
      host.window().close();
      await stable();
      expect(element('omni-window').classList).not.toContain('omni-window-to-dock');
    });
  });
});
