import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowFooterDirective, WindowHeaderDirective } from '../../directives/window-slots.directive';
import { DesktopTheme, Rect, WindowPosition } from '../../models/types';
import { WindowComponent } from './window.component';

@Component({
  imports: [WindowComponent, WindowHeaderDirective, WindowFooterDirective],
  template: `
    <omni-window
      header="Test window"
      icon="icon.svg"
      [position]="position()"
      [theme]="theme()"
      [width]="200"
      [height]="100"
      [draggable]="draggable()"
      [closable]="closable()"
      [keepInBounds]="keepInBounds()"
      [(visible)]="visible"
      [(minimized)]="minimized"
      [(maximized)]="maximized"
      (closed)="closedCount = closedCount + 1"
      (dragEnd)="dragEnds.push($event)"
      (resizeEnd)="resizeEnds.push($event)"
    >
      <p class="content">Content</p>
      @if (customHeader()) {
        <span omniWindowHeader class="custom-header">Custom</span>
      }
      @if (footer()) {
        <div omniWindowFooter class="custom-footer">Footer</div>
      }
    </omni-window>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly window = viewChild.required(WindowComponent);
  readonly position = signal<WindowPosition>('topleft');
  readonly theme = signal<DesktopTheme | undefined>(undefined);
  readonly draggable = signal(true);
  readonly closable = signal(true);
  readonly keepInBounds = signal(true);
  readonly customHeader = signal(false);
  readonly footer = signal(false);
  readonly visible = signal(true);
  readonly minimized = signal(false);
  readonly maximized = signal(false);
  closedCount = 0;
  dragEnds: Rect[] = [];
  resizeEnds: Rect[] = [];
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

function drag(handle: Element, dx: number, dy: number): void {
  pointer(handle, 'pointerdown', 500, 500);
  pointer(document, 'pointermove', 500 + dx, 500 + dy);
  pointer(document, 'pointerup', 500 + dx, 500 + dy);
}

describe('WindowComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const query = <T extends Element = HTMLElement>(selector: string): T | null => element.querySelector<T>(selector);
  const button = (label: string): HTMLButtonElement | null =>
    query<HTMLButtonElement>(`.omni-window-button[aria-label="${label}"]`);
  const stable = () => fixture.whenStable();

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await stable();
    element = fixture.nativeElement.querySelector('omni-window');
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders the header text, icon and projected content', () => {
      expect(query('.omni-window-header-text')?.textContent).toContain('Test window');
      expect(query<HTMLImageElement>('.omni-window-icon')?.getAttribute('src')).toBe('icon.svg');
      expect(query('.omni-window-content .content')).not.toBeNull();
      expect(element.getAttribute('aria-label')).toBe('Test window');
    });

    it('replaces the default title with projected header content', async () => {
      host.customHeader.set(true);
      await stable();
      expect(query('.custom-header')).not.toBeNull();
      expect(query('.omni-window-header-text')).toBeNull();
    });

    it('only shows the footer when footer content is projected', async () => {
      expect(query('.omni-window-footer')?.hidden).toBe(true);
      host.footer.set(true);
      await stable();
      expect(query('.omni-window-footer')?.hidden).toBe(false);
    });

    it('applies the theme class', async () => {
      host.theme.set('neo-tokyo');
      await stable();
      expect(element.classList).toContain('omni-theme-neo-tokyo');
    });

    it('hides the close button when not closable', async () => {
      host.closable.set(false);
      await stable();
      expect(button('Close')).toBeNull();
    });

    it('renders eight resize handles', () => {
      expect(element.querySelectorAll('.omni-resize-handle')).toHaveLength(8);
    });
  });

  describe('placement', () => {
    it('measures and places the window at its initial position', () => {
      expect(host.window().rect()).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(element.style.transform).toBe('translate3d(0px, 0px, 0)');
      expect(element.style.width).toBe('200px');
      expect(element.classList).not.toContain('omni-window-measuring');
    });

    it('is positioned in the viewport when used outside a desktop', async () => {
      expect(element.classList).toContain('omni-window-standalone');
      const other = TestBed.createComponent(HostComponent);
      other.componentInstance.position.set('bottomright');
      await other.whenStable();
      expect(other.componentInstance.window().rect()).toEqual({
        x: window.innerWidth - 200,
        y: window.innerHeight - 100,
        width: 200,
        height: 100,
      });
    });
  });

  describe('dragging', () => {
    it('moves the window by dragging the header and emits dragEnd', () => {
      drag(query('.omni-window-header')!, 40, 30);
      expect(host.window().rect()).toEqual({ x: 40, y: 30, width: 200, height: 100 });
      expect(host.dragEnds).toEqual([{ x: 40, y: 30, width: 200, height: 100 }]);
    });

    it('keeps the window inside the viewport when keepInBounds is on', () => {
      drag(query('.omni-window-header')!, -100, -100);
      expect(host.window().rect()).toMatchObject({ x: 0, y: 0 });
    });

    it('can leave the viewport when keepInBounds is off', async () => {
      host.keepInBounds.set(false);
      await stable();
      drag(query('.omni-window-header')!, -100, -50);
      expect(host.window().rect()).toMatchObject({ x: -100, y: -50 });
    });

    it('does not move when not draggable', async () => {
      host.draggable.set(false);
      await stable();
      drag(query('.omni-window-header')!, 40, 30);
      expect(host.window().rect()).toMatchObject({ x: 0, y: 0 });
      expect(host.dragEnds).toEqual([]);
    });

    it('does not move while maximized', async () => {
      host.maximized.set(true);
      await stable();
      drag(query('.omni-window-header')!, 40, 30);
      expect(host.window().rect()).toMatchObject({ x: 0, y: 0 });
    });

    it('does not start a drag from the header buttons', () => {
      drag(button('Close')!, 40, 30);
      expect(host.dragEnds).toEqual([]);
    });
  });

  describe('resizing', () => {
    it('resizes from the south-east corner and emits resizeEnd', () => {
      drag(query('.omni-resize-se')!, 50, 25);
      expect(host.window().rect()).toEqual({ x: 0, y: 0, width: 250, height: 125 });
      expect(host.resizeEnds).toEqual([{ x: 0, y: 0, width: 250, height: 125 }]);
    });

    it('respects the minimum size', () => {
      drag(query('.omni-resize-e')!, -500, 0);
      expect(host.window().rect()?.width).toBe(130);
    });

    it('resizes from the west edge keeping the east edge in place', () => {
      drag(query('.omni-window-header')!, 100, 0);
      drag(query('.omni-resize-w')!, -30, 0);
      expect(host.window().rect()).toEqual({ x: 70, y: 0, width: 230, height: 100 });
    });

    it('hides resize handles while maximized or minimized', async () => {
      host.maximized.set(true);
      await stable();
      expect(element.querySelectorAll('.omni-resize-handle')).toHaveLength(0);
      host.maximized.set(false);
      host.minimized.set(true);
      await stable();
      expect(element.querySelectorAll('.omni-resize-handle')).toHaveLength(0);
    });
  });

  describe('window state', () => {
    it('closes with the close button', async () => {
      button('Close')!.click();
      await stable();
      expect(host.visible()).toBe(false);
      expect(host.closedCount).toBe(1);
      expect(element.classList).toContain('omni-window-away');
      expect(element.getAttribute('aria-hidden')).toBe('true');
    });

    it('collapses to a title bar when minimized outside a desktop and restores again', async () => {
      button('Minimize')!.click();
      await stable();
      expect(host.minimized()).toBe(true);
      expect(element.classList).toContain('omni-window-collapsed');
      expect(element.classList).not.toContain('omni-window-away');
      expect(query('.omni-window-move-icon')).not.toBeNull();
      expect(element.style.width).toBe('');

      button('Restore')!.click();
      await stable();
      expect(host.minimized()).toBe(false);
      expect(element.style.width).toBe('200px');
    });

    it('maximizes with the button and restores the previous rect', async () => {
      button('Maximize')!.click();
      await stable();
      expect(host.maximized()).toBe(true);
      expect(element.classList).toContain('omni-window-maximized');
      expect(element.style.transform).toBe('');

      button('Restore size')!.click();
      await stable();
      expect(host.maximized()).toBe(false);
      expect(element.style.transform).toBe('translate3d(0px, 0px, 0)');
    });

    it('toggles maximize on header double-click', async () => {
      query('.omni-window-header')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await stable();
      expect(host.maximized()).toBe(true);
    });

    it('blocks page scrolling while maximized outside a desktop', async () => {
      host.maximized.set(true);
      await stable();
      expect(document.body.style.overflow).toBe('hidden');
      host.maximized.set(false);
      await stable();
      expect(document.body.style.overflow).toBe('');
    });

    it('un-maximizes when minimized', async () => {
      host.maximized.set(true);
      await stable();
      host.window().toggleMinimize();
      await stable();
      expect(host.maximized()).toBe(false);
      expect(host.minimized()).toBe(true);
    });

    it('restore() shows a closed window again', async () => {
      host.visible.set(false);
      await stable();
      host.window().restore();
      await stable();
      expect(host.visible()).toBe(true);
      expect(element.classList).not.toContain('omni-window-away');
    });

    it('raises its z-index when focused', async () => {
      const before = Number(element.style.zIndex);
      pointer(query('.content')!, 'pointerdown', 0, 0);
      await stable();
      expect(Number(element.style.zIndex)).toBeGreaterThan(before);
    });
  });
});
