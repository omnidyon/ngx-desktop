import { ChangeDetectionStrategy, Component, signal, viewChild, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowComponent } from '../window/window.component';
import { DesktopComponent } from './desktop.component';
import { injectDesktop } from './inject-desktop';

@Component({
  selector: 'test-toolbar',
  template: `<button type="button" class="tile-from-inside" (click)="desktop.tile('columns')">Tile</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ToolbarComponent {
  readonly desktop = injectDesktop();
}

@Component({
  imports: [DesktopComponent, WindowComponent, ToolbarComponent],
  template: `
    <omni-desktop #desk="omniDesktop" [allowOverlap]="allow()" [snapPadding]="padding()">
      <omni-window header="A" persistKey="a" [x]="10" [y]="10" [width]="200" [height]="100"
        ><test-toolbar
      /></omni-window>
      <omni-window header="B" [x]="300" [y]="10" [width]="200" [height]="100" />
      <omni-window
        header="C"
        [x]="10"
        [y]="300"
        [width]="200"
        [height]="100"
        [minimizable]="false"
        [closable]="false"
      />
      <omni-window header="W" widget [x]="600" [y]="400" [width]="150" [height]="150" />
    </omni-desktop>
    <button type="button" class="tile-from-ref" (click)="desk.tile('rows')">Tile</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly desktop = viewChild.required(DesktopComponent);
  readonly windows = viewChildren(WindowComponent);
  readonly allow = signal(true);
  readonly padding = signal(0);
}

@Component({
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class OutsideComponent {
  readonly optional = injectDesktop({ optional: true });
}

/** Desktop is 800 × 600 (the dock is not measured in jsdom). */
describe('Desktop API', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const desk = () => host.desktop();
  const win = (header: string) => host.windows().find((w) => w.header() === header)!;
  const stable = () => fixture.whenStable();

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    setup(host);
    await stable();
    await new Promise((resolve) => setTimeout(resolve));
    await stable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  it('lists the windows and widgets, and which one is in front', async () => {
    await create();
    expect(
      desk()
        .windows()
        .map((w) => [w.header, w.widget, w.persistKey])
    ).toEqual([
      ['A', false, 'a'],
      ['B', false, undefined],
      ['C', false, undefined],
      ['W', true, undefined],
    ]);
    expect(desk().windows()[1]).toMatchObject({ visible: true, minimized: false, maximized: false });
    expect(desk().windows()[1].rect).toEqual({ x: 300, y: 10, width: 200, height: 100 });
    expect(desk().focusedId()).toBe(win('W').id);
  });

  it('focuses a window, restoring it when minimized or closed', async () => {
    await create();
    win('A').minimize();
    win('B').close();
    desk().focus(win('A').id);
    expect(win('A').minimized()).toBe(false);
    expect(desk().focusedId()).toBe(win('A').id);
    desk().focus(win('B').id);
    expect(win('B').visible()).toBe(true);
    expect(desk().focusedId()).toBe(win('B').id);
    desk().focus('unknown');
    expect(desk().focusedId()).toBe(win('B').id);
  });

  it('minimizes and restores all windows that can be, leaving widgets', async () => {
    await create();
    desk().minimizeAll();
    expect(['A', 'B', 'C', 'W'].map((h) => win(h).minimized())).toEqual([true, true, false, false]);
    desk().restoreAll();
    expect(['A', 'B', 'C', 'W'].map((h) => win(h).minimized())).toEqual([false, false, false, false]);
  });

  it('shows the desktop and brings back only what it hid', async () => {
    await create();
    win('B').minimize();
    desk().toggleShowDesktop();
    expect(desk().showingDesktop()).toBe(true);
    expect(win('A').minimized()).toBe(true);

    desk().toggleShowDesktop();
    expect(desk().showingDesktop()).toBe(false);
    expect(win('A').minimized()).toBe(false);
    expect(win('B').minimized()).toBe(true); // was minimized before
  });

  it('stops showing the desktop once the user restored every hidden window', async () => {
    await create();
    desk().toggleShowDesktop();
    win('A').restore();
    win('B').restore();
    expect(desk().showingDesktop()).toBe(false);
    desk().toggleShowDesktop();
    expect(win('A').minimized()).toBe(true);
  });

  it('closes every closable window and widget', async () => {
    await create();
    desk().closeAll();
    expect(['A', 'B', 'C', 'W'].map((h) => win(h).visible())).toEqual([false, false, true, false]);
  });

  describe('tile', () => {
    it('arranges the open windows in a grid, leaving widgets and minimized windows', async () => {
      await create();
      desk().tile();
      expect(win('A').rect()).toEqual({ x: 0, y: 0, width: 400, height: 300 });
      expect(win('B').rect()).toEqual({ x: 400, y: 0, width: 400, height: 300 });
      expect(win('C').rect()).toEqual({ x: 0, y: 300, width: 800, height: 300 });
      expect(win('W').rect()).toEqual({ x: 600, y: 400, width: 150, height: 150 });

      win('B').minimize();
      desk().tile('columns');
      expect(win('A').rect()).toEqual({ x: 0, y: 0, width: 400, height: 600 });
      expect(win('C').rect()).toEqual({ x: 400, y: 0, width: 400, height: 600 });
    });

    it('keeps the snap padding and un-maximizes windows', async () => {
      await create((h) => h.padding.set(10));
      win('A').toggleMaximize();
      desk().tile('rows');
      expect(win('A').maximized()).toBe(false);
      expect(win('A').rect()).toEqual({ x: 10, y: 10, width: 780, height: 186 });
      expect(win('C').rect()).toEqual({ x: 10, y: 402, width: 780, height: 186 });
    });

    it('makes room for widgets when overlap is not allowed', async () => {
      await create((h) => h.allow.set(false));
      desk().tile();
      const widget = win('W').rect()!;
      for (const header of ['A', 'B', 'C']) {
        const rect = win(header).rect()!;
        const overlaps =
          rect.x < widget.x + widget.width &&
          widget.x < rect.x + rect.width &&
          rect.y < widget.y + widget.height &&
          widget.y < rect.y + rect.height;
        expect(overlaps, header).toBe(false);
      }
    });

    it('works from a template reference and from injectDesktop() inside a window', async () => {
      await create();
      (fixture.nativeElement.querySelector('.tile-from-ref') as HTMLButtonElement).click();
      expect(win('B').rect()).toEqual({ x: 0, y: 200, width: 800, height: 200 });
      (fixture.nativeElement.querySelector('.tile-from-inside') as HTMLButtonElement).click();
      expect(win('B').rect()).toEqual({ x: 266, y: 0, width: 266, height: 600 });
    });
  });

  describe('cascade', () => {
    it('stacks the open windows diagonally in stacking order, keeping their sizes', async () => {
      await create();
      win('A').focus(); // order bottom to top: B, C, A
      expect(desk().cascade()).toBe(true);
      expect(win('B').rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(win('C').rect()).toEqual({ x: 32, y: 32, width: 200, height: 100 });
      expect(win('A').rect()).toEqual({ x: 64, y: 64, width: 200, height: 100 });
      expect(desk().focusedId()).toBe(win('A').id);
    });

    it('does nothing when overlap is not allowed', async () => {
      await create((h) => h.allow.set(false));
      const before = win('B').rect();
      expect(desk().cascade()).toBe(false);
      expect(win('B').rect()).toEqual(before);
    });
  });

  it('injectDesktop() throws outside a desktop unless optional', () => {
    expect(TestBed.createComponent(OutsideComponent).componentInstance.optional).toBeNull();
    expect(() => TestBed.runInInjectionContext(() => injectDesktop())).toThrow(/outside an <omni-desktop>/);
  });
});
