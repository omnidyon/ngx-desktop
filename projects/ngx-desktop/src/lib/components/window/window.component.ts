/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  viewChild,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DESKTOP_LABELS, formatLabel } from '../../config/desktop-labels';
import { DraggableDirective, DragPointerEvent } from '../../directives/draggable.directive';
import {
  WindowContentDirective,
  WindowFooterDirective,
  WindowHeaderDirective,
} from '../../directives/window-slots.directive';
import { fitWithoutOverlap, limitMove, limitResize } from '../../geometry/fit';
import { Length, resolveLength } from '../../geometry/length';
import { magneticMove, magneticResize } from '../../geometry/magnetic-snap';
import { placeRect } from '../../geometry/placement';
import { clampRect, moveRect } from '../../geometry/rect';
import { resizeRect } from '../../geometry/resize';
import { limitSize, limitZoneRect } from '../../geometry/size-limits';
import { detectZone, zoneRect } from '../../geometry/snap-zones';
import { DesktopWindow } from '../../models/desktop-window';
import { DesktopTheme, Rect, ResizeDirection, Size, SnapZone, WindowPosition } from '../../models/types';
import { ForgottenLayouts } from '../../persistence/forgotten-layouts';
import { DESKTOP_LAYOUT_STORAGE } from '../../persistence/layout-storage.provider';
import { isWindowLayout, WindowLayout } from '../../persistence/window-layout';
import { DesktopService } from '../../services/desktop.service';
import { blockBodyScroll, unblockBodyScroll } from '../../utils/body-scroll';
import { uniqueId } from '../../utils/unique-id';
import { CloseIconComponent } from '../icons/close-icon/close-icon.component';
import { FullScreenIconComponent } from '../icons/full-screen-icon/full-screen-icon.component';
import { MaximizeIconComponent } from '../icons/maximize-icon/maximize-icon.component';
import { MinimizeIconComponent } from '../icons/minimize-icon/minimize-icon.component';
import { MoveIconComponent } from '../icons/move-icon/move-icon.component';

/** @internal */
export const DEFAULT_MIN_WIDTH = 130;
/** @internal */
export const DEFAULT_MIN_HEIGHT = 65;
/** @internal How long a window waits after its last change before saving its layout. */
export const LAYOUT_SAVE_DELAY = 300;

/** @internal Pixels an arrow key moves or resizes a window (Alt+arrow: {@link KEYBOARD_FINE_STEP}). */
export const KEYBOARD_STEP = 10;
/** @internal */
export const KEYBOARD_FINE_STEP = 1;
/** @internal How long keyboard changes settle before they are announced (a held key repeats quickly). */
export const ANNOUNCE_DELAY = 250;
/** @internal Longest wait for the closing animation (no animation: the whole wait) before `omniWindowContent` is destroyed. */
export const CONTENT_DESTROY_DELAY = 500;
/** @internal How long the pointer rests on the maximize button before the snap layouts open. */
export const LAYOUT_HOVER_DELAY = 400;
/** @internal How long a touch on the maximize button lasts before it opens the snap layouts. */
export const LAYOUT_LONG_PRESS = 500;

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const ARROW_KEYS: Readonly<Record<string, { x: number; y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Stacking counter for windows that are not inside a desktop. */
let standaloneTop = 0;
/** The standalone window raised last. */
let standaloneFrontId: string | null = null;

/**
 * @publicApi
 * @description
 * A draggable, resizable window. Inside an `<omni-desktop>` it is positioned within the desktop,
 * listed in its dock and stacked with the other windows; on its own it is positioned within the viewport.
 *
 * Initial placement, first match wins:
 * 1. the layout saved under `persistKey`
 * 2. `[rect]`
 * 3. `x` / `y` / `width` / `height` (px or %), with `position` used for an axis without `x` / `y`
 * 4. `position` and the `--omni-window-width` / `--omni-window-height` size
 *
 * @usageNotes
 * <omni-window header="Notes" icon="assets/notes.svg" x="25%" y="40" width="480" persistKey="notes">
 *   <span omniWindowHeader>Custom title</span>      -- optional, replaces icon + header
 *   Window content
 *   <ng-template omniWindowContent>Only while shown</ng-template>  -- optional
 *   <div omniWindowFooter>Footer content</div>    -- optional
 * </omni-window>
 */
@Component({
  selector: 'omni-window',
  imports: [
    NgTemplateOutlet,
    DraggableDirective,
    CloseIconComponent,
    FullScreenIconComponent,
    MaximizeIconComponent,
    MinimizeIconComponent,
    MoveIconComponent,
  ],
  templateUrl: './window.component.html',
  styleUrl: './window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'widget() ? "region" : "dialog"',
    '[attr.id]': 'id',
    '[attr.aria-label]': 'header() || null',
    '[attr.aria-hidden]': 'isAway() || null',
    '[class]': 'hostClasses()',
    '[style.transform]': 'transform()',
    '[style.transform-origin]': 'transformOrigin()',
    '[style.--omni-dock-dx]': 'dockFlight()?.dx',
    '[style.--omni-dock-dy]': 'dockFlight()?.dy',
    '[style.--omni-dock-sx]': 'dockFlight()?.sx',
    '[style.--omni-dock-sy]': 'dockFlight()?.sy',
    '[style.width.px]': 'styleWidth()',
    '[style.height.px]': 'styleHeight()',
    '[style.z-index]': 'zIndex()',
    '(pointerdown)': 'focus()',
    // Keyboard focus moving into the window (Tab, a screen reader, element.focus()) raises it too.
    '(focusin)': 'focus()',
    '(transitionend)': 'onTransitionEnd($event)',
    '(window:resize)': 'onViewportResize()',
    '(document:fullscreenchange)': 'onFullScreenChange()',
  },
})
export class WindowComponent implements DesktopWindow {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(DESKTOP_CONFIG);
  protected readonly labels = inject(DESKTOP_LABELS);
  private readonly storage = inject(DESKTOP_LAYOUT_STORAGE);
  private readonly forgotten = inject(ForgottenLayouts);
  private readonly desktop = inject(DesktopService, { optional: true });

  readonly id = uniqueId('omni-window-');

  /** Title shown in the header and in the dock when there is no icon. */
  readonly header = input('');
  /** Image URL shown in the header and used as the dock tab. */
  readonly icon = input<string>();
  /** Initial placement; `x` / `y` override it per axis. */
  readonly position = input<WindowPosition>('center');
  /** Initial left edge: px (`120`, `'120px'`) or a percentage of the desktop/viewport width (`'25%'`). */
  readonly x = input<Length>();
  /** Initial top edge: px or a percentage of the desktop/viewport height. */
  readonly y = input<Length>();
  /** Initial width: px or percentage. Defaults to `--omni-window-width`. */
  readonly width = input<Length>();
  /** Initial height: px or percentage. Defaults to `--omni-window-height`. */
  readonly height = input<Length>();
  /** Theme preset; when unset the window inherits the desktop's (or the default) theme. */
  readonly theme = input<DesktopTheme>();
  readonly minWidth = input(DEFAULT_MIN_WIDTH, { transform: numberAttribute });
  readonly minHeight = input(DEFAULT_MIN_HEIGHT, { transform: numberAttribute });
  /** Largest width: px or a percentage of the desktop/viewport width. No limit by default. */
  readonly maxWidth = input<Length>();
  /** Largest height: px or a percentage of the desktop/viewport height. No limit by default. */
  readonly maxHeight = input<Length>();
  readonly closable = input(true, { transform: booleanAttribute });
  readonly draggable = input(true, { transform: booleanAttribute });
  readonly resizable = input(true, { transform: booleanAttribute });
  readonly maximizable = input(true, { transform: booleanAttribute });
  readonly minimizable = input(true, { transform: booleanAttribute });
  readonly fullScreenable = input(true, { transform: booleanAttribute });
  /** Keeps the window inside the desktop (or viewport) while dragging and resizing. */
  readonly keepInBounds = input(true, { transform: booleanAttribute });
  /** Whether this window snaps to zones and other windows (only inside a desktop with snapping enabled). */
  readonly snappable = input(true, { transform: booleanAttribute });
  /**
   * Widget mode: no title bar. The widget is moved by a grip that appears on hover (always visible on
   * touch screens), keeps its resize handles, shows a small close button when `closable`, and gets
   * no dock tab. Snapping, overlap rules, `persistKey` and sessions work as for windows.
   */
  readonly widget = input(false, { transform: booleanAttribute });
  /** Shown on the window's dock tab, e.g. an unread count. `null`, `''` and `0` show nothing. */
  readonly badge = input<string | number | null>();
  /**
   * Keeps the window's dock tab while it is closed, like a pinned app in a taskbar: clicking the tab opens it
   * again. The window has to stay in the template (closing only hides it). Not for widgets, which have no tab.
   */
  readonly pinned = input(false, { transform: booleanAttribute });
  /**
   * Saves the window's position, size, snapped zone and minimized/maximized/visible state under
   * this key (IndexedDB by default, see `provideDesktopLayoutStorage`) and restores it on load.
   * Keys must be unique per window. The saved `visible` / `minimized` / `maximized` state wins over the
   * template's values, so a window the user closed stays closed after a reload: offer a way to reopen it
   * through `[(visible)]` unless it belongs to a desktop session.
   */
  readonly persistKey = input<string>();

  /** Whether the window is shown. Set to `false` by the close button. */
  readonly visible = model(true);
  /** Minimized: moved to the dock inside a desktop, collapsed to a small title bar otherwise. */
  readonly minimized = model(false);
  readonly maximized = model(false);
  /**
   * Current position and size in px, relative to the desktop (or viewport); `null` until placed.
   * Bind `[(rect)]` to read it live or to move/resize the window from code.
   */
  readonly rect = model<Rect | null>(null);

  /** Emitted when the close button is used. */
  readonly closed = output<void>();
  readonly dragEnd = output<Rect>();
  readonly resizeStart = output<Rect>();
  readonly resizeEnd = output<Rect>();
  readonly fullScreenChange = output<boolean>();
  /** Emitted when the window is snapped into a zone, and with `null` when it is dragged out of it. */
  readonly snapped = output<SnapZone | null>();

  protected readonly resizeDirections = RESIZE_DIRECTIONS;
  protected readonly fullScreen = signal(false);
  protected readonly interacting = signal(false);
  protected readonly customHeader = contentChild(WindowHeaderDirective);
  protected readonly customFooter = contentChild(WindowFooterDirective);
  /** Content that only exists while the window is shown (`<ng-template omniWindowContent>`). */
  protected readonly lazyContent = contentChild(WindowContentDirective);
  /** Whether `omniWindowContent` is rendered: from the first time the window is shown until it goes away. */
  protected readonly contentAlive = signal(false);
  /** Id of the keyboard help text the title bar (or widget grip) points to. */
  protected readonly keyboardHelpId = `${this.id}-keys`;
  /** Text of the polite live region: what the last keyboard move, resize or snap did. */
  protected readonly announcement = signal('');

  /** Placed (and, with a `persistKey`, restored); the window stays hidden until then. */
  private readonly ready = signal(false);
  private readonly standaloneZ = signal(this.config.zIndex.window);
  /** The zone the window is snapped into, kept so it can re-fit when the desktop is resized. */
  private readonly snapZone = signal<SnapZone | null>(null);
  /** Size before the window was snapped into a zone; restored when it is dragged out again. */
  private readonly restoreSize = signal<Size | null>(null);
  /** Where a minimized window flies to: its dock tab, as CSS offsets and scales from its own centre. */
  protected readonly dockFlight = signal<{ dx: string; dy: string; sx: string; sy: string } | null>(null);

  private interactionStart: Rect | null = null;
  /** What the pointer is doing right now. */
  private interaction: 'drag' | 'resize' | null = null;
  /** Resolves the wait in initialize() once the bounds are big enough to place the window. */
  private boundsWaiter: (() => void) | null = null;
  /** The zone under the pointer during the current drag. */
  private dragZone: SnapZone | null = null;
  /** Without overlap: where the dragged window will land (`null`: nowhere, it goes back). */
  private dragLanding: Rect | null = null;
  /** A snapped window is only un-snapped once it actually moves, not on a plain click. */
  private unsnapPending = false;
  /** The last rect this component wrote; anything else in `rect` was set from outside. */
  private ownRect: Rect | null = null;
  /** A save that is waiting for the debounce delay; written immediately if the window is destroyed. */
  private pendingSave: { key: string; layout: WindowLayout } | null = null;
  private destroyed = false;
  private announceTimer: ReturnType<typeof setTimeout> | undefined;
  private layoutHoverTimer: ReturnType<typeof setTimeout> | undefined;
  private contentTimer: ReturnType<typeof setTimeout> | undefined;
  private layoutPressTimer: ReturnType<typeof setTimeout> | undefined;
  /** A long press opened the snap layouts; the click that ends it must not maximize. */
  private skipMaximizeClick = false;
  private readonly maximizeButton = viewChild<ElementRef<HTMLButtonElement>>('maximizeButton');

  /** Collapsed to a title bar (minimized while not inside a desktop). */
  protected readonly collapsed = computed(() => this.minimized() && !this.desktop);
  /** Hidden from view: closed, or minimized into the dock. */
  protected readonly isAway = computed(() => !this.visible() || (this.minimized() && !!this.desktop));
  protected readonly canDrag = computed(() => this.draggable() && !this.maximized() && !this.fullScreen());
  protected readonly canResize = computed(
    () => this.resizable() && !this.maximized() && !this.minimized() && !this.fullScreen()
  );

  /** Widgets have no dock tab. */
  readonly dockable = computed(() => !this.widget());
  /** Whether the maximize button offers the snap layouts. */
  protected readonly layoutsAvailable = computed(() => {
    const settings = this.desktop?.settings;
    return (
      !!settings &&
      settings.snapLayouts() &&
      settings.snapToZones() &&
      this.snappable() &&
      this.draggable() &&
      !this.fullScreen() &&
      !this.minimized()
    );
  });

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return {
      'omni-window': true,
      'omni-window-standalone': !this.desktop,
      'omni-window-measuring': !this.ready(),
      'omni-window-maximized': this.maximized(),
      'omni-window-collapsed': this.collapsed(),
      'omni-window-away': this.isAway(),
      'omni-window-full-screen': this.fullScreen(),
      'omni-window-interacting': this.interacting(),
      'omni-window-focused': this.desktop?.focusedId() === this.id,
      'omni-window-widget': this.widget(),
      'omni-window-to-dock': this.minimized() && !!this.dockFlight(),
      'omni-motion-system': this.config.motion === 'system',
      'omni-motion-full': this.config.motion === 'full',
      'omni-motion-none': this.config.motion === 'none',
      [`omni-theme-${theme}`]: !!theme,
    };
  });

  protected readonly transform = computed(() => {
    const rect = this.rect();
    return rect && !this.maximized() ? `translate3d(${rect.x}px, ${rect.y}px, 0)` : null;
  });
  /** Scale (open, close, minimize) around the window's own centre: its box sits at the container's 0,0. */
  protected readonly transformOrigin = computed(() => {
    const rect = this.rect();
    return rect && !this.maximized() ? `${rect.x + rect.width / 2}px ${rect.y + rect.height / 2}px` : null;
  });
  protected readonly styleWidth = computed(() => this.sizeStyle('width'));
  protected readonly styleHeight = computed(() => this.sizeStyle('height'));
  protected readonly zIndex = computed(() => (this.desktop ? this.desktop.zIndex(this.id) : this.standaloneZ()));

  constructor() {
    this.desktop?.register(this);

    afterNextRender(() => void this.initialize());

    // A rect set from outside (`[(rect)]`) is kept inside the bounds and ends any snapped state.
    effect(() => {
      const rect = this.rect();
      untracked(() => this.onExternalRect(rect));
    });

    // A window created while its desktop is hidden is placed once the desktop is shown again.
    // `shownCount` says "the desktop was measured again"; the live check decides.
    effect(() => {
      this.desktop?.shownCount();
      untracked(() => {
        if (!this.boundsWaiter || this.desktop?.isHidden()) return;
        const waiter = this.boundsWaiter;
        this.boundsWaiter = null;
        waiter();
      });
    });

    // Minimizing inside a desktop: find the dock tab to fly into. Kept after restoring, so the window
    // grows back out of the same tab.
    effect(() => {
      if (!this.minimized()) return;
      untracked(() => this.dockFlight.set(this.flightToDock()));
    });

    // `omniWindowContent` lives while the window is shown; it is destroyed once the closing animation
    // has ended (or after CONTENT_DESTROY_DELAY), so the window does not empty itself while it shrinks.
    effect(() => {
      const shown = this.ready() && !this.isAway();
      untracked(() => {
        clearTimeout(this.contentTimer);
        if (shown) {
          this.contentAlive.set(true);
        } else if (this.contentAlive()) {
          this.contentTimer = setTimeout(() => this.contentAlive.set(false), CONTENT_DESTROY_DELAY);
        }
      });
    });

    // The snap layouts close when the window goes away or stops offering them.
    effect(() => {
      if (this.layoutsAvailable() && !this.isAway()) return;
      untracked(() => {
        clearTimeout(this.layoutHoverTimer);
        this.desktop?.closeLayoutPicker(this.id);
      });
    });

    // A resize ends when its handles disappear (e.g. the window is maximized mid-resize).
    effect(() => {
      if (this.canResize()) return;
      untracked(() => {
        if (this.interaction === 'resize') this.onResizeEnd();
      });
    });

    // Inside a desktop: follow changes of the desktop's size.
    effect(() => {
      const desktop = this.desktop;
      if (!desktop) return;
      // shownCount changes on every resize and when a hidden desktop is shown again (even at the same
      // size), so rects accepted while it was hidden are fitted once it is visible.
      desktop.shownCount();
      untracked(() => this.fitToBounds());
    });

    // A maximized window outside a desktop covers the viewport; stop the page behind it from scrolling.
    effect((onCleanup) => {
      if (this.desktop || !this.maximized() || this.isAway()) return;
      blockBodyScroll(this.document, this.id);
      onCleanup(() => unblockBodyScroll(this.document, this.id));
    });

    // Save the layout a moment after the last change (never in the middle of a drag or resize).
    effect((onCleanup) => {
      const key = this.persistKey();
      const layout = this.currentLayout();
      if (!key || !layout || !this.ready() || this.interacting() || this.forgotten.has(key)) return;
      this.pendingSave = { key, layout };
      const timer = setTimeout(() => this.flushSave(), LAYOUT_SAVE_DELAY);
      onCleanup(() => clearTimeout(timer));
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.flushSave();
      this.desktop?.unregister(this.id);
      unblockBodyScroll(this.document, this.id);
      if (standaloneFrontId === this.id) standaloneFrontId = null;
      clearTimeout(this.announceTimer);
      clearTimeout(this.layoutHoverTimer);
      clearTimeout(this.layoutPressTimer);
      clearTimeout(this.contentTimer);
    });
  }

  /** Brings the window to the front. */
  focus(): void {
    if (this.desktop) {
      this.desktop.focus(this.id);
    } else {
      if (standaloneFrontId !== this.id) {
        standaloneFrontId = this.id;
        this.standaloneZ.set(this.config.zIndex.window + ++standaloneTop);
      }
    }
  }

  /** Shows the window again after it was minimized or closed, and brings it to the front. */
  restore(): void {
    const wasAway = this.isAway();
    this.visible.set(true);
    this.minimized.set(false);
    const rect = this.rect();
    if (wasAway && rect) this.setRect(this.arrange(rect));
    this.focus();
  }

  close(): void {
    this.visible.set(false);
    this.closed.emit();
  }

  /** Minimizes the window (into the dock inside a desktop); nothing happens when it is not `minimizable`. */
  minimize(): void {
    if (!this.minimizable() || this.minimized()) return;
    this.minimized.set(true);
    this.maximized.set(false);
  }

  /**
   * @internal
   * Puts the window at a rect chosen by its desktop (tile, cascade): not maximized or snapped any more,
   * within its size limits. Overlap is the desktop's job here, so the rect is not fitted around others.
   */
  place(rect: Rect): void {
    this.leaveZone(true);
    this.maximized.set(false);
    const bounds = this.bounds();
    const limited = this.limit(rect, bounds);
    this.setRect(this.keepInBounds() ? clampRect(limited, bounds) : limited);
  }

  toggleMinimize(): void {
    if (!this.minimizable()) return;
    this.minimized.update((minimized) => !minimized);
    if (this.minimized()) this.maximized.set(false);
  }

  toggleMaximize(): void {
    if (!this.maximizable() || this.minimized()) return;
    this.maximized.update((maximized) => !maximized);
  }

  toggleFullScreen(): void {
    if (!this.fullScreenable()) return;
    if (this.document.fullscreenElement === this.element) {
      void this.document.exitFullscreen?.();
    } else {
      void this.element.requestFullscreen?.();
    }
  }

  /**
   * Deletes the layout saved under `persistKey` and stops saving it; the current window is not moved.
   * A new window with the same `persistKey` saves again.
   */
  async forgetLayout(): Promise<void> {
    const key = this.persistKey();
    if (!key) return;
    this.pendingSave = null;
    this.forgotten.forget(key);
    await this.storage.remove(key);
  }

  protected onHeaderDoubleClick(event: MouseEvent): void {
    // Double-clicking a header button (e.g. Close) is two clicks on that button, not a maximize.
    if ((event.target as Element | null)?.closest?.('.omni-window-buttons')) return;
    if (!this.collapsed()) this.toggleMaximize();
  }

  /**
   * Keys on the focused title bar (or widget grip): arrows move, Shift+arrows resize from the right/bottom
   * edge, Ctrl+arrows snap (left/right half, maximize, and restore or minimize). Alt makes steps 1px.
   */
  protected onHeaderKeydown(event: KeyboardEvent): void {
    // Alt+Z (like Win+Z) works from the title bar and its maximize button. `code`: on macOS Alt+Z types Ω.
    if (event.altKey && event.code === 'KeyZ' && this.layoutsAvailable()) {
      event.preventDefault();
      this.openLayouts(true);
      return;
    }
    // Keys in header buttons or in a custom header's own controls are theirs.
    if (event.target !== event.currentTarget) return;
    const arrow = ARROW_KEYS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const step = event.altKey ? KEYBOARD_FINE_STEP : KEYBOARD_STEP;
    if (event.ctrlKey || event.metaKey) {
      this.keyboardSnap(event.key);
    } else if (event.shiftKey) {
      this.keyboardResize(arrow.x * step, arrow.y * step);
    } else {
      this.keyboardMove(arrow.x * step, arrow.y * step);
    }
  }

  /** The closing fade has ended: `omniWindowContent` can go now instead of after the full wait. */
  protected onTransitionEnd(event: TransitionEvent): void {
    if (event.target !== this.element || event.propertyName !== 'opacity' || !this.isAway()) return;
    clearTimeout(this.contentTimer);
    this.contentAlive.set(false);
  }

  protected onMaximizeClick(): void {
    clearTimeout(this.layoutHoverTimer);
    this.desktop?.closeLayoutPicker(this.id);
    if (this.skipMaximizeClick) {
      this.skipMaximizeClick = false;
      return;
    }
    this.toggleMaximize();
  }

  protected onMaximizeEnter(): void {
    if (!this.layoutsAvailable()) return;
    this.desktop?.keepLayoutPicker();
    clearTimeout(this.layoutHoverTimer);
    this.layoutHoverTimer = setTimeout(() => this.openLayouts(false), LAYOUT_HOVER_DELAY);
  }

  protected onMaximizeLeave(): void {
    clearTimeout(this.layoutHoverTimer);
    if (this.desktop?.layoutPicker()?.window.id === this.id) this.desktop.closeLayoutPickerSoon();
  }

  /** Touch screens have no hover: a long press opens the snap layouts instead. */
  protected onMaximizePointerDown(event: PointerEvent): void {
    this.skipMaximizeClick = false;
    if (event.pointerType !== 'touch' || !this.layoutsAvailable()) return;
    clearTimeout(this.layoutPressTimer);
    this.layoutPressTimer = setTimeout(() => {
      this.skipMaximizeClick = true;
      this.openLayouts(false);
    }, LAYOUT_LONG_PRESS);
  }

  protected onMaximizePointerEnd(): void {
    clearTimeout(this.layoutPressTimer);
  }

  /** Snaps the window into a zone of the snap layouts. */
  snapTo(zone: SnapZone): void {
    const start = this.rect();
    if (!start || this.isAway()) return;
    if (zone === 'maximize') {
      this.maximized.set(true);
      return;
    }
    if (this.snapToZone(zone, start)) {
      const labels = this.labels();
      this.announce(labels.announceSnappedZone, { zone: labels.zones[zone] });
    }
  }

  private openLayouts(fromKeyboard: boolean): void {
    clearTimeout(this.layoutHoverTimer);
    const button = this.maximizeButton()?.nativeElement;
    const desktop = this.desktop;
    if (!button || !desktop || !this.layoutsAvailable()) return;
    const box = button.getBoundingClientRect();
    const { x, y } = desktop.toLocal(box.left, box.top);
    const focused = this.document.activeElement;
    desktop.openLayoutPicker({
      window: this,
      anchor: { x, y, width: box.width, height: box.height },
      returnFocus: fromKeyboard && focused instanceof HTMLElement ? focused : null,
    });
  }

  protected onDragStart(): void {
    this.desktop?.closeLayoutPicker(this.id);
    this.interactionStart = this.rect();
    this.interaction = this.interactionStart ? 'drag' : null;
    this.interacting.set(!!this.interactionStart);
    this.unsnapPending = !!this.restoreSize();
  }

  protected onDragMove(event: DragPointerEvent): void {
    if (!this.interactionStart) return;
    if (this.unsnapPending) this.unsnap(event);

    const start = this.interactionStart;
    const bounds = this.bounds();
    let next = moveRect(start, event.dx, event.dy, this.keepInBounds() ? this.visibleBounds() : undefined);

    const desktop = this.snappingDesktop();
    if (desktop) {
      const { snapToZones, snapToWindows, snapThreshold, snapPadding } = desktop.settings;
      const pointer = desktop.toLocal(event.clientX, event.clientY);
      this.dragZone = snapToZones() ? detectZone(pointer, bounds, snapThreshold()) : null;
      if (!this.dragZone && snapToWindows()) {
        next = magneticMove(next, desktop.otherRects(this.id), bounds, snapThreshold(), snapPadding());
        if (this.keepInBounds()) next = clampRect(next, bounds);
      }
      const zoneTarget = this.dragZone ? this.zoneTarget(this.dragZone, bounds) : null;
      desktop.showSnapPreview(zoneTarget ? { rect: zoneTarget, zIndex: this.zIndex() } : null);
    }

    const blocking = this.overlapDesktop();
    if (blocking && this.dragZone !== 'maximize') {
      // The window follows the pointer; the preview shows where it will actually land.
      const target = this.dragZone ? this.zoneTarget(this.dragZone, bounds) : next;
      const landing = this.fit(target);
      this.dragLanding = landing;
      const showLanding = !!landing && (!!this.dragZone || !sameRect(landing, next));
      blocking.showSnapPreview(landing && showLanding ? { rect: landing, zIndex: this.zIndex() } : null);
    }

    this.setRect(next);
  }

  protected onDragEnd(): void {
    const zone = this.dragZone;
    const start = this.interactionStart;
    const landing = this.dragLanding;
    this.dragZone = null;
    this.dragLanding = null;
    this.unsnapPending = false;
    this.desktop?.showSnapPreview(null);

    if (start && this.overlapDesktop() && zone !== 'maximize') {
      this.landWithoutOverlap(zone, start, landing);
    } else if (zone && start) {
      if (zone === 'maximize') {
        this.setRect(start);
        this.maximized.set(true);
      } else {
        // Remember the size to go back to when the window is dragged out of the zone again.
        this.restoreSize.set({ width: start.width, height: start.height });
        this.snapZone.set(zone);
        this.setRect(this.zoneTarget(zone, this.bounds()));
      }
      this.snapped.emit(zone);
    }
    this.finishInteraction(this.dragEnd);
  }

  protected onResizeStart(): void {
    // A snapped window that is resized by hand keeps its new size.
    this.restoreSize.set(null);
    this.snapZone.set(null);
    this.interactionStart = this.rect();
    this.interaction = this.interactionStart ? 'resize' : null;
    this.interacting.set(!!this.interactionStart);
    if (this.interactionStart) this.resizeStart.emit(this.interactionStart);
  }

  protected onResizeMove(direction: ResizeDirection, event: DragPointerEvent): void {
    if (!this.interactionStart) return;
    const minSize = { width: this.minWidth(), height: this.minHeight() };
    const bounds = this.bounds();
    let next = resizeRect(
      this.interactionStart,
      direction,
      event.dx,
      event.dy,
      minSize,
      this.keepInBounds() ? bounds : undefined,
      this.maxSize(bounds)
    );

    const desktop = this.snappingDesktop();
    if (desktop?.settings.snapToWindows()) {
      const others = desktop.otherRects(this.id);
      const { snapThreshold, snapPadding } = desktop.settings;
      const max = this.maxSize(bounds);
      next = magneticResize(next, direction, others, bounds, snapThreshold(), minSize, snapPadding(), max);
    }
    const blocking = this.overlapDesktop();
    if (blocking) {
      next = limitResize(next, this.interactionStart, direction, blocking.otherRects(this.id), this.snapPadding());
    }
    this.setRect(next);
  }

  protected onResizeEnd(): void {
    this.finishInteraction(this.resizeEnd);
  }

  protected onViewportResize(): void {
    // Windows inside a desktop follow the desktop's own size instead (see constructor).
    if (!this.desktop) this.fitToBounds();
  }

  protected onFullScreenChange(): void {
    const fullScreen = this.document.fullscreenElement === this.element;
    if (fullScreen === this.fullScreen()) return;
    this.fullScreen.set(fullScreen);
    this.fullScreenChange.emit(fullScreen);
  }

  private keyboardMove(dx: number, dy: number): void {
    const start = this.rect();
    if (!start || !this.canDrag() || this.isAway()) return;
    this.leaveZone(true);
    const bounds = this.bounds();
    let next = moveRect(start, dx, dy, this.keepInBounds() ? this.visibleBounds(start) : undefined);

    const desktop = this.snappingDesktop();
    if (desktop?.settings.snapToWindows()) {
      const { snapThreshold, snapPadding } = desktop.settings;
      const pulled = magneticMove(next, desktop.otherRects(this.id), bounds, snapThreshold(), snapPadding());
      next = { ...next, x: along(next.x, pulled.x, dx), y: along(next.y, pulled.y, dy) };
      if (this.keepInBounds()) next = clampRect(next, bounds);
    }
    const blocking = this.overlapDesktop();
    if (blocking) {
      next = limitMove(start, next.x - start.x, next.y - start.y, blocking.otherRects(this.id), this.snapPadding());
    }

    this.setRect(next);
    this.dragEnd.emit(next);
    this.announce(this.labels().announceMoved, { x: Math.round(next.x - bounds.x), y: Math.round(next.y - bounds.y) });
  }

  private keyboardResize(dx: number, dy: number): void {
    const start = this.rect();
    if (!start || !this.canResize() || this.isAway()) return;
    // Like a resize by hand: the window keeps its new size and is no longer in its zone.
    this.leaveZone(false);
    const direction: ResizeDirection = dx !== 0 ? 'e' : 's';
    const bounds = this.bounds();
    const minSize = this.minSize();
    const maxSize = this.maxSize(bounds);
    this.resizeStart.emit(start);
    let next = resizeRect(start, direction, dx, dy, minSize, this.keepInBounds() ? bounds : undefined, maxSize);

    const desktop = this.snappingDesktop();
    if (desktop?.settings.snapToWindows()) {
      const others = desktop.otherRects(this.id);
      const { snapThreshold, snapPadding } = desktop.settings;
      const pulled = magneticResize(next, direction, others, bounds, snapThreshold(), minSize, snapPadding(), maxSize);
      const right = along(next.x + next.width, pulled.x + pulled.width, dx);
      const bottom = along(next.y + next.height, pulled.y + pulled.height, dy);
      next = { ...next, width: right - next.x, height: bottom - next.y };
    }
    const blocking = this.overlapDesktop();
    if (blocking) next = limitResize(next, start, direction, blocking.otherRects(this.id), this.snapPadding());

    this.setRect(next);
    this.resizeEnd.emit(next);
    this.announce(this.labels().announceResized, { width: Math.round(next.width), height: Math.round(next.height) });
  }

  /** Ctrl+Left/Right: snap to that half. Ctrl+Up: maximize. Ctrl+Down: restore, or minimize when not snapped. */
  private keyboardSnap(key: string): void {
    const start = this.rect();
    if (!start || this.isAway()) return;
    const labels = this.labels();

    if (key === 'ArrowUp') {
      if (this.maximized() || !this.maximizable() || this.minimized()) return;
      this.maximized.set(true);
      this.announce(labels.announceMaximized);
    } else if (key === 'ArrowDown') {
      if (this.maximized()) {
        this.maximized.set(false);
        this.announce(labels.announceRestored);
      } else if (this.snapZone() || this.restoreSize()) {
        this.restoreFromZone(start);
        this.announce(labels.announceRestored);
      } else if (this.minimizable() && !this.minimized()) {
        this.toggleMinimize();
        // Hidden in the dock now: keep the keyboard user next to it.
        this.desktop?.dockTab(this.id)?.focus();
      }
    } else {
      const zone: SnapZone = key === 'ArrowLeft' ? 'left' : 'right';
      if (!this.snappingDesktop()?.settings.snapToZones() || !this.draggable() || this.fullScreen()) return;
      if (this.snapToZone(zone, start)) {
        this.announce(zone === 'left' ? labels.announceSnappedLeft : labels.announceSnappedRight);
      }
    }
  }

  /** Snaps into a zone from the keyboard; `false` when there is no room for it (overlap not allowed). */
  private snapToZone(zone: SnapZone, start: Rect): boolean {
    const target = this.zoneTarget(zone, this.bounds());
    const landing = this.overlapDesktop() ? this.fit(target) : target;
    if (!landing) return false;
    // A window moved from one half to the other keeps the size from before its first snap.
    const restore = this.restoreSize() ?? { width: start.width, height: start.height };
    // Only a window that got its whole zone counts as snapped (and follows the zone on resizes).
    const snappedZone = sameRect(landing, target) ? zone : null;
    this.maximized.set(false);
    this.restoreSize.set(restore);
    this.snapZone.set(snappedZone);
    this.setRect(landing);
    this.snapped.emit(snappedZone);
    return true;
  }

  /** Back to the size from before the window was snapped, keeping its top-left corner. */
  private restoreFromZone(start: Rect): void {
    const size = this.restoreSize();
    this.leaveZone(true);
    if (!size) return;
    const bounds = this.bounds();
    const limited = this.limit({ ...start, ...size }, bounds);
    this.setRect(this.arrange(this.keepInBounds() ? clampRect(limited, bounds) : limited));
  }

  /** Forgets the snapped zone (a window moved or resized from the keyboard is no longer in it). */
  private leaveZone(emit: boolean): void {
    const wasSnapped = !!this.snapZone() || !!this.restoreSize();
    this.snapZone.set(null);
    this.restoreSize.set(null);
    if (emit && wasSnapped) this.snapped.emit(null);
  }

  /** Tells screen readers what a keyboard action did, once a held key has settled. */
  private announce(label: string, values: Readonly<Record<string, string | number>> = {}): void {
    clearTimeout(this.announceTimer);
    const text = formatLabel(label, { name: this.header() || this.labels().untitledWindow, ...values });
    this.announceTimer = setTimeout(() => this.announcement.set(text), ANNOUNCE_DELAY);
  }

  /** Places the window: from its saved layout when there is one, otherwise from its inputs. */
  private async initialize(): Promise<void> {
    const key = this.persistKey();
    let saved: WindowLayout | null = null;
    if (key) {
      // A new window with this key saves again, even if an earlier one was forgotten.
      this.forgotten.revive(key);
      try {
        saved = await this.storage.load(key);
      } catch (error) {
        console.warn(`[ngx-desktop] Could not load the layout "${key}"; using the initial placement.`, error);
      }
    }
    if (this.destroyed) return;
    await this.whenShown();
    if (this.destroyed) return;

    if (isWindowLayout(saved)) {
      this.applyLayout(saved);
    } else {
      this.setRect(this.arrange(this.initialRect()));
    }
    this.ready.set(true);
  }

  /** The rect from `[rect]`, or else from `x`/`y`/`width`/`height`/`position`. */
  private initialRect(): Rect {
    const bounds = this.bounds();
    const given = this.rect();
    if (given) {
      const limited = this.limit(given, bounds);
      return this.keepInBounds() ? clampRect(limited, bounds) : limited;
    }

    const size = this.limit(
      {
        x: 0,
        y: 0,
        width: resolveLength(this.width(), bounds.width) ?? this.element.offsetWidth,
        height: resolveLength(this.height(), bounds.height) ?? this.element.offsetHeight,
      },
      bounds
    );
    const placed = placeRect(this.position(), size, bounds);
    const x = resolveLength(this.x(), bounds.width);
    const y = resolveLength(this.y(), bounds.height);
    const rect = {
      ...placed,
      x: x === undefined ? placed.x : bounds.x + x,
      y: y === undefined ? placed.y : bounds.y + y,
    };
    return this.keepInBounds() ? clampRect(rect, bounds) : rect;
  }

  private applyLayout(layout: WindowLayout): void {
    const bounds = this.bounds();
    // Zones only exist inside a desktop; re-fit them to the desktop's current size.
    const zone = this.desktop ? layout.zone : null;
    this.snapZone.set(zone);
    // Also kept without a zone: a window that only partly fitted its zone still drags out to its old size.
    this.restoreSize.set(this.desktop ? layout.restoreSize : null);
    let rect = this.limit(layout.rect, bounds);
    if (zone) {
      rect = this.zoneTarget(zone, bounds);
    } else if (this.keepInBounds()) {
      rect = clampRect(rect, bounds);
    }
    this.visible.set(layout.visible);
    this.minimized.set(layout.minimized);
    this.maximized.set(layout.maximized);

    const arranged = this.arrange(rect);
    if (arranged !== rect) {
      // It no longer fits where it was saved (overlap not allowed), so it is not in its zone any more.
      this.snapZone.set(null);
      this.restoreSize.set(null);
    }
    this.setRect(arranged);
  }

  private currentLayout(): WindowLayout | null {
    const rect = this.rect();
    if (!rect) return null;
    return {
      version: 1,
      rect,
      zone: this.snapZone(),
      restoreSize: this.restoreSize(),
      minimized: this.minimized(),
      maximized: this.maximized(),
      visible: this.visible(),
    };
  }

  private flushSave(): void {
    const pending = this.pendingSave;
    this.pendingSave = null;
    // A forgotten layout (closed through a session, or forgetLayout()) must not be written back.
    if (!pending || this.forgotten.has(pending.key)) return;
    this.storage.save(pending.key, pending.layout).catch((error: unknown) => {
      console.warn(`[ngx-desktop] Could not save the layout "${pending.key}".`, error);
    });
  }

  /** Writes the rect from inside the component (so it is not mistaken for an outside change). */
  private setRect(rect: Rect): void {
    this.ownRect = rect;
    this.rect.set(rect);
  }

  private onExternalRect(rect: Rect | null): void {
    // Before the window is placed, a given rect is picked up by initialRect().
    if (rect === this.ownRect || !this.ready() || !rect) return;
    this.snapZone.set(null);
    this.restoreSize.set(null);
    // A hidden desktop measures 0 × 0: take the rect as given; it is fitted when the desktop is shown.
    if (this.desktop?.isHidden()) {
      this.setRect(rect);
      return;
    }
    const bounds = this.bounds();
    const limited = this.limit(rect, bounds);
    this.setRect(this.arrange(this.keepInBounds() ? clampRect(limited, bounds) : limited));
  }

  /** Keeps a snapped window in its zone and other windows inside the bounds after a resize of the bounds. */
  private fitToBounds(): void {
    const rect = this.rect();
    if (!rect || !this.ready() || this.interactionStart || this.desktop?.isHidden()) return;
    const bounds = this.bounds();
    const zone = this.snapZone();
    if (zone) {
      this.setRect(this.zoneTarget(zone, bounds));
    } else {
      // Percentage limits follow the desktop size.
      const limited = this.limit(rect, bounds);
      this.setRect(this.keepInBounds() ? clampRect(limited, bounds) : limited);
    }
  }

  private flightToDock(): { dx: string; dy: string; sx: string; sy: string } | null {
    const rect = this.rect();
    const tab = this.desktop?.dockTabRect(this.id);
    if (!rect || !tab || rect.width <= 0 || rect.height <= 0) return null;
    const dx = tab.x + tab.width / 2 - (rect.x + rect.width / 2);
    const dy = tab.y + tab.height / 2 - (rect.y + rect.height / 2);
    return { dx: `${dx}px`, dy: `${dy}px`, sx: `${tab.width / rect.width}`, sy: `${tab.height / rect.height}` };
  }

  /** Smallest size, from `minWidth` / `minHeight`. */
  private minSize(): Size {
    return { width: this.minWidth(), height: this.minHeight() };
  }

  /** Largest size, from `maxWidth` / `maxHeight` (percentages of the bounds); never below the minimum. */
  private maxSize(bounds: Rect): Size {
    const width = resolveLength(this.maxWidth(), bounds.width) ?? Number.POSITIVE_INFINITY;
    const height = resolveLength(this.maxHeight(), bounds.height) ?? Number.POSITIVE_INFINITY;
    return { width: Math.max(width, this.minWidth()), height: Math.max(height, this.minHeight()) };
  }

  /** Keeps a rect within the size limits. */
  private limit(rect: Rect, bounds: Rect): Rect {
    return limitSize(rect, this.minSize(), this.maxSize(bounds));
  }

  /** The rect of a snap zone for this window: maximize fills the desktop, other zones respect the maximum size. */
  private zoneTarget(zone: SnapZone, bounds: Rect): Rect {
    const rect = zoneRect(zone, bounds, this.snapPadding());
    return zone === 'maximize' ? rect : limitZoneRect(zone, rect, this.maxSize(bounds));
  }

  /** The desktop, when it does not allow windows to overlap. */
  private overlapDesktop(): DesktopService | null {
    return this.desktop && !this.desktop.settings.allowOverlap() ? this.desktop : null;
  }

  /** Where `rect` can go without overlapping the other windows, or `null` when there is no room. */
  private fit(rect: Rect): Rect | null {
    const desktop = this.desktop;
    if (!desktop) return rect;
    const minSize = { width: this.minWidth(), height: this.minHeight() };
    return fitWithoutOverlap(rect, desktop.otherRects(this.id), desktop.bounds(), minSize, this.snapPadding());
  }

  /**
   * Places a window that is opened, restored or set from code: when overlap is not allowed it is
   * fitted into free space if there is room, otherwise left where it is.
   */
  private arrange(rect: Rect): Rect {
    if (!this.overlapDesktop() || this.isAway() || this.maximized() || this.desktop?.isHidden()) return rect;
    const fitted = this.fit(rect);
    return fitted && !sameRect(fitted, rect) ? fitted : rect;
  }

  /** Ends a drag when overlap is not allowed: land where the preview showed, or go back. */
  private landWithoutOverlap(zone: SnapZone | null, start: Rect, landing: Rect | null): void {
    if (!landing) {
      this.setRect(start);
      return;
    }
    const zoneTarget = zone ? this.zoneTarget(zone, this.bounds()) : null;
    // Only a window that got its whole zone counts as snapped (and follows the zone on resizes).
    const snappedZone = zoneTarget && sameRect(landing, zoneTarget) ? zone : null;
    this.snapZone.set(snappedZone);
    this.restoreSize.set(zone ? { width: start.width, height: start.height } : null);
    this.setRect(landing);
    if (zone) this.snapped.emit(snappedZone);
  }

  /** Gap kept around snapped windows (0 outside a desktop). */
  private snapPadding(): number {
    return this.desktop?.settings.snapPadding() ?? 0;
  }

  /** The desktop, when this window takes part in snapping. */
  private snappingDesktop(): DesktopService | null {
    return this.desktop && this.snappable() ? this.desktop : null;
  }

  /**
   * Leaves a snapped zone: the window gets its size from before the snap back, positioned so the
   * point of the header under the pointer stays under the pointer (like Windows Aero Snap).
   */
  private unsnap(event: DragPointerEvent): void {
    const start = this.interactionStart;
    const size = this.restoreSize();
    this.unsnapPending = false;
    this.restoreSize.set(null);
    this.snapZone.set(null);
    if (!start || !size || !this.desktop) return;

    const pointer = this.desktop.toLocal(event.startX, event.startY);
    const ratio = start.width > 0 ? (pointer.x - start.x) / start.width : 0;
    this.interactionStart = { x: pointer.x - ratio * size.width, y: start.y, ...size };
    this.snapped.emit(null);
  }

  /** The area the window lives in: the desktop, or the viewport when standalone. */
  private bounds(): Rect {
    if (this.desktop) return this.desktop.bounds();
    const view = this.document.defaultView;
    return { x: 0, y: 0, width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 };
  }

  /**
   * Resolves once the desktop is visible: right away when it is (or outside a desktop). A visible
   * desktop smaller than the window is fine; the window is then shrunk to fit.
   */
  private whenShown(): Promise<void> {
    if (!this.desktop?.isHidden()) return Promise.resolve();
    return new Promise((resolve) => (this.boundsWaiter = resolve));
  }

  /** Bounds for the window's current visual size (a collapsed window is smaller than its rect). */
  private visibleBounds(start = this.interactionStart): Rect {
    const bounds = this.bounds();
    if (!this.collapsed() || !start) return bounds;
    const { width, height } = start;
    return {
      ...bounds,
      width: bounds.width + width - this.element.offsetWidth,
      height: bounds.height + height - this.element.offsetHeight,
    };
  }

  private finishInteraction(emitter: { emit(value: Rect): void }): void {
    const rect = this.rect();
    const started = !!this.interactionStart;
    this.interactionStart = null;
    this.interaction = null;
    this.interacting.set(false);
    if (started && rect) emitter.emit(rect);
  }

  private sizeStyle(dimension: 'width' | 'height'): number | null {
    const rect = this.rect();
    return rect && !this.maximized() && !this.collapsed() ? rect[dimension] : null;
  }
}

/**
 * A magnetic pull is taken from the keyboard only when it goes further the way the key moves the edge;
 * otherwise a window next to an edge could never step away from it.
 */
function along(plain: number, pulled: number, delta: number): number {
  return delta !== 0 && Math.sign(pulled - plain) === Math.sign(delta) ? pulled : plain;
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
