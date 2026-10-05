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
  model,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DraggableDirective, DragPointerEvent } from '../../directives/draggable.directive';
import { WindowFooterDirective, WindowHeaderDirective } from '../../directives/window-slots.directive';
import { placeRect } from '../../geometry/placement';
import { clampRect, moveRect } from '../../geometry/rect';
import { resizeRect } from '../../geometry/resize';
import { DesktopWindow } from '../../models/desktop-window';
import { DesktopTheme, Rect, ResizeDirection, WindowPosition } from '../../models/types';
import { DesktopService } from '../../services/desktop.service';
import { blockBodyScroll, unblockBodyScroll } from '../../utils/body-scroll';
import { uniqueId } from '../../utils/unique-id';
import { CloseIconComponent } from '../icons/close-icon/close-icon.component';
import { FullScreenIconComponent } from '../icons/full-screen-icon/full-screen-icon.component';
import { MaximizeIconComponent } from '../icons/maximize-icon/maximize-icon.component';
import { MinimizeIconComponent } from '../icons/minimize-icon/minimize-icon.component';
import { MoveIconComponent } from '../icons/move-icon/move-icon.component';
import { ResizeIconComponent } from '../icons/resize-icon/resize-icon.component';

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
    ResizeIconComponent,
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

  /** Current position and size, relative to the desktop (or viewport). `null` until measured. */
  readonly rect = signal<Rect | null>(null);

  protected readonly resizeDirections = RESIZE_DIRECTIONS;
  protected readonly fullScreen = signal(false);
  protected readonly interacting = signal(false);
  protected readonly customHeader = contentChild(WindowHeaderDirective);
  protected readonly customFooter = contentChild(WindowFooterDirective);

  private readonly standaloneZ = signal(this.config.zIndex.window);
  private interactionStart: Rect | null = null;

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
  }

  protected onDragMove(event: DragPointerEvent): void {
    if (!this.interactionStart) return;
    const bounds = this.keepInBounds() ? this.visibleBounds() : undefined;
    this.rect.set(moveRect(this.interactionStart, event.dx, event.dy, bounds));
  }

  protected onDragEnd(): void {
    this.finishInteraction(this.dragEnd);
  }

  protected onResizeStart(): void {
    this.interactionStart = this.rect();
    this.interacting.set(!!this.interactionStart);
    if (this.interactionStart) this.resizeStart.emit(this.interactionStart);
  }

  protected onResizeMove(direction: ResizeDirection, event: DragPointerEvent): void {
    if (!this.interactionStart) return;
    const minSize = { width: this.minWidth(), height: this.minHeight() };
    const bounds = this.keepInBounds() ? this.bounds() : undefined;
    this.rect.set(resizeRect(this.interactionStart, direction, event.dx, event.dy, minSize, bounds));
  }

  protected onResizeEnd(): void {
    this.finishInteraction(this.resizeEnd);
  }

  protected onViewportResize(): void {
    const rect = this.rect();
    if (rect && this.keepInBounds()) this.rect.set(clampRect(rect, this.bounds()));
  }

  protected onFullScreenChange(): void {
    const fullScreen = this.document.fullscreenElement === this.element;
    if (fullScreen === this.fullScreen()) return;
    this.fullScreen.set(fullScreen);
    this.fullScreenChange.emit(fullScreen);
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
