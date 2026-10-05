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
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
  model,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DraggableDirective, DragPointerEvent } from '../../directives/draggable.directive';
import { WindowFooterDirective, WindowHeaderDirective } from '../../directives/window-slots.directive';
import { placeRect } from '../../geometry/placement';
import { magneticMove, magneticResize } from '../../geometry/magnetic-snap';
import { clampRect, moveRect } from '../../geometry/rect';
import { resizeRect } from '../../geometry/resize';
import { detectZone, zoneRect } from '../../geometry/snap-zones';
import { DesktopWindow } from '../../models/desktop-window';
import { DesktopTheme, Rect, ResizeDirection, Size, SnapZone, WindowPosition } from '../../models/types';
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

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** Stacking counter for windows that are not inside a desktop. */
let standaloneTop = 0;

/**
 * @publicApi
 * @description
 * A draggable, resizable window. Inside an `<omni-desktop>` it is positioned within the desktop,
 * listed in its dock and stacked with the other windows; on its own it is positioned within the viewport.
 *
 * @usageNotes
 * <omni-window header="Notes" icon="assets/notes.svg" position="center" theme="aqua">
 *   <span omniWindowHeader>Custom title</span>      -- optional, replaces icon + header
 *   Window content
 *   <div omniWindowFooter>Footer content</div>    -- optional
 * </omni-window>
 */
@Component({
  selector: 'omni-window',
  imports: [
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
    role: 'dialog',
    '[attr.id]': 'id',
    '[attr.aria-label]': 'header() || null',
    '[attr.aria-hidden]': 'isAway() || null',
    '[class]': 'hostClasses()',
    '[style.transform]': 'transform()',
    '[style.width.px]': 'styleWidth()',
    '[style.height.px]': 'styleHeight()',
    '[style.z-index]': 'zIndex()',
    '(pointerdown)': 'focus()',
    '(window:resize)': 'onViewportResize()',
    '(document:fullscreenchange)': 'onFullScreenChange()',
  },
})
export class WindowComponent implements DesktopWindow {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(DESKTOP_CONFIG);
  private readonly desktop = inject(DesktopService, { optional: true });

  readonly id = uniqueId('omni-window-');

  /** Title shown in the header and in the dock when there is no icon. */
  readonly header = input('');
  /** Image URL shown in the header and used as the dock tab. */
  readonly icon = input<string>();
  /** Initial placement. */
  readonly position = input<WindowPosition>('center');
  /** Theme preset; when unset the window inherits the desktop's (or the default) theme. */
  readonly theme = input<DesktopTheme>();
  /** Initial width in px. Defaults to `--omni-window-width`. */
  readonly width = input<number | undefined, unknown>(undefined, { transform: optionalNumber });
  /** Initial height in px. Defaults to `--omni-window-height`. */
  readonly height = input<number | undefined, unknown>(undefined, { transform: optionalNumber });
  readonly minWidth = input(DEFAULT_MIN_WIDTH, { transform: numberAttribute });
  readonly minHeight = input(DEFAULT_MIN_HEIGHT, { transform: numberAttribute });
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

  /** Whether the window is shown. Set to `false` by the close button. */
  readonly visible = model(true);
  /** Minimized: moved to the dock inside a desktop, collapsed to a small title bar otherwise. */
  readonly minimized = model(false);
  readonly maximized = model(false);

  /** Emitted when the close button is used. */
  readonly closed = output<void>();
  readonly dragEnd = output<Rect>();
  readonly resizeStart = output<Rect>();
  readonly resizeEnd = output<Rect>();
  readonly fullScreenChange = output<boolean>();
  /** Emitted when the window is snapped into a zone, and with `null` when it is dragged out of it. */
  readonly snapped = output<SnapZone | null>();

  /** Current position and size, relative to the desktop (or viewport). `null` until measured. */
  readonly rect = signal<Rect | null>(null);

  protected readonly resizeDirections = RESIZE_DIRECTIONS;
  protected readonly fullScreen = signal(false);
  protected readonly interacting = signal(false);
  protected readonly customHeader = contentChild(WindowHeaderDirective);
  protected readonly customFooter = contentChild(WindowFooterDirective);

  private readonly standaloneZ = signal(this.config.zIndex.window);
  private interactionStart: Rect | null = null;
  /** The zone under the pointer during the current drag. */
  private dragZone: SnapZone | null = null;
  /** The zone the window is snapped into, kept so it can re-fit when the desktop is resized. */
  private snapZone: SnapZone | null = null;
  /** Size before the window was snapped into a zone; restored when it is dragged out again. */
  private restoreSize: Size | null = null;
  /** A snapped window is only un-snapped once it actually moves, not on a plain click. */
  private unsnapPending = false;

  /** Collapsed to a title bar (minimized while not inside a desktop). */
  protected readonly collapsed = computed(() => this.minimized() && !this.desktop);
  /** Hidden from view: closed, or minimized into the dock. */
  protected readonly isAway = computed(() => !this.visible() || (this.minimized() && !!this.desktop));
  protected readonly canDrag = computed(() => this.draggable() && !this.maximized() && !this.fullScreen());
  protected readonly canResize = computed(
    () => this.resizable() && !this.maximized() && !this.minimized() && !this.fullScreen()
  );

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return {
      'omni-window': true,
      'omni-window-standalone': !this.desktop,
      'omni-window-measuring': !this.rect(),
      'omni-window-maximized': this.maximized(),
      'omni-window-collapsed': this.collapsed(),
      'omni-window-away': this.isAway(),
      'omni-window-full-screen': this.fullScreen(),
      'omni-window-interacting': this.interacting(),
      'omni-window-focused': this.desktop?.focusedId() === this.id,
      [`omni-theme-${theme}`]: !!theme,
    };
  });

  protected readonly transform = computed(() => {
    const rect = this.rect();
    return rect && !this.maximized() ? `translate3d(${rect.x}px, ${rect.y}px, 0)` : null;
  });
  protected readonly styleWidth = computed(() => this.sizeStyle('width'));
  protected readonly styleHeight = computed(() => this.sizeStyle('height'));
  protected readonly zIndex = computed(() => (this.desktop ? this.desktop.zIndex(this.id) : this.standaloneZ()));

  constructor() {
    this.desktop?.register(this);

    afterNextRender(() => this.initRect());

    // Inside a desktop: follow changes of the desktop's size.
    effect(() => {
      const desktop = this.desktop;
      if (!desktop) return;
      desktop.size();
      untracked(() => this.fitToBounds());
    });

    // A maximized window outside a desktop covers the viewport; stop the page behind it from scrolling.
    effect((onCleanup) => {
      if (this.desktop || !this.maximized() || this.isAway()) return;
      blockBodyScroll(this.document, this.id);
      onCleanup(() => unblockBodyScroll(this.document, this.id));
    });

    inject(DestroyRef).onDestroy(() => {
      this.desktop?.unregister(this.id);
      unblockBodyScroll(this.document, this.id);
    });
  }

  /** Brings the window to the front. */
  focus(): void {
    if (this.desktop) {
      this.desktop.focus(this.id);
    } else {
      this.standaloneZ.set(this.config.zIndex.window + ++standaloneTop);
    }
  }

  /** Shows the window again after it was minimized or closed, and brings it to the front. */
  restore(): void {
    this.visible.set(true);
    this.minimized.set(false);
    this.focus();
  }

  close(): void {
    this.visible.set(false);
    this.closed.emit();
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

  protected onHeaderDoubleClick(): void {
    if (!this.collapsed()) this.toggleMaximize();
  }

  protected onDragStart(): void {
    this.interactionStart = this.rect();
    this.interacting.set(!!this.interactionStart);
    this.unsnapPending = !!this.restoreSize;
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
      const preview = this.dragZone ? zoneRect(this.dragZone, bounds, snapPadding()) : null;
      desktop.showSnapPreview(preview ? { rect: preview, zIndex: this.zIndex() } : null);
    }

    this.rect.set(next);
  }

  protected onDragEnd(): void {
    const zone = this.dragZone;
    const start = this.interactionStart;
    this.dragZone = null;
    this.unsnapPending = false;
    this.desktop?.showSnapPreview(null);

    if (zone && start) {
      // Remember the size to go back to when the window is dragged out of the zone again.
      this.restoreSize = { width: start.width, height: start.height };
      if (zone === 'maximize') {
        this.restoreSize = null;
        this.rect.set(start);
        this.maximized.set(true);
      } else {
        this.snapZone = zone;
        this.rect.set(zoneRect(zone, this.bounds(), this.snapPadding()));
      }
      this.snapped.emit(zone);
    }
    this.finishInteraction(this.dragEnd);
  }

  protected onResizeStart(): void {
    // A snapped window that is resized by hand keeps its new size.
    this.restoreSize = null;
    this.snapZone = null;
    this.interactionStart = this.rect();
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
      this.keepInBounds() ? bounds : undefined
    );

    const desktop = this.snappingDesktop();
    if (desktop?.settings.snapToWindows()) {
      const others = desktop.otherRects(this.id);
      const { snapThreshold, snapPadding } = desktop.settings;
      next = magneticResize(next, direction, others, bounds, snapThreshold(), minSize, snapPadding());
    }
    this.rect.set(next);
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

  /** Keeps a snapped window in its zone and other windows inside the bounds after a resize of the bounds. */
  private fitToBounds(): void {
    const rect = this.rect();
    if (!rect || this.interactionStart) return;
    const bounds = this.bounds();
    if (this.snapZone) {
      this.rect.set(zoneRect(this.snapZone, bounds, this.snapPadding()));
    } else if (this.keepInBounds()) {
      this.rect.set(clampRect(rect, bounds));
    }
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
    const size = this.restoreSize;
    this.unsnapPending = false;
    this.restoreSize = null;
    this.snapZone = null;
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

  /** Bounds for the window's current visual size (a collapsed window is smaller than its rect). */
  private visibleBounds(): Rect {
    const bounds = this.bounds();
    if (!this.collapsed() || !this.interactionStart) return bounds;
    const { width, height } = this.interactionStart;
    return {
      ...bounds,
      width: bounds.width + width - this.element.offsetWidth,
      height: bounds.height + height - this.element.offsetHeight,
    };
  }

  private initRect(): void {
    const size = {
      width: Math.max(this.width() ?? this.element.offsetWidth, this.minWidth()),
      height: Math.max(this.height() ?? this.element.offsetHeight, this.minHeight()),
    };
    this.rect.set(placeRect(this.position(), size, this.bounds()));
  }

  private finishInteraction(emitter: { emit(value: Rect): void }): void {
    const rect = this.rect();
    const started = !!this.interactionStart;
    this.interactionStart = null;
    this.interacting.set(false);
    if (started && rect) emitter.emit(rect);
  }

  private sizeStyle(dimension: 'width' | 'height'): number | null {
    const rect = this.rect();
    return rect && !this.maximized() && !this.collapsed() ? rect[dimension] : null;
  }
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined || value === null || value === '' ? undefined : numberAttribute(value);
}
