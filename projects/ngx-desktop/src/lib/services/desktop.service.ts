/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { DESKTOP_CONFIG } from '../config/desktop-config';
import { cascadeRects, tileRects } from '../geometry/arrange';
import { fitWithoutOverlap } from '../geometry/fit';
import { DesktopWindow } from '../models/desktop-window';
import { ArrangeTarget, Rect, Size, TileMode } from '../models/types';

/**
 * @internal
 * @description
 * Behaviour settings of a desktop, read by its windows while they are dragged or resized.
 */
export interface DesktopSettings {
  snapToZones: Signal<boolean>;
  snapToWindows: Signal<boolean>;
  snapThreshold: Signal<number>;
  snapPadding: Signal<number>;
  allowOverlap: Signal<boolean>;
  snapLayouts: Signal<boolean>;
}

/** @internal */
export const DEFAULT_SNAP_THRESHOLD = 16;

/** @internal How far each cascaded window is moved right and down from the previous one. */
export const CASCADE_STEP = 32;

/** @internal How long the snap layouts stay open after the pointer leaves the maximize button or the flyout. */
export const LAYOUT_PICKER_CLOSE_DELAY = 300;

/** @internal The snap layouts flyout, opened for one window. */
export interface LayoutPicker {
  window: DesktopWindow;
  /** The maximize button it belongs to, in container coordinates. */
  anchor: Rect;
  /** Opened from the keyboard: focus moves into the flyout and back here when it closes. */
  returnFocus: HTMLElement | null;
}

/** @internal */
export interface SnapPreview {
  rect: Rect;
  zIndex: number;
}

/**
 * @internal
 * @description
 * Per-desktop registry of windows. Provided by `DesktopComponent`, so every
 * `<omni-desktop>` has its own instance. Tracks registration order (for the dock),
 * stacking order (for z-index / focus) and the snap preview shown while dragging.
 */
@Injectable()
export class DesktopService {
  private readonly config = inject(DESKTOP_CONFIG);
  private container: HTMLElement | null = null;
  /** Finds the dock tab of a window; registered by the dock. */
  private dockLocator: ((id: string) => HTMLElement | null) | null = null;

  private readonly _windows = signal<readonly DesktopWindow[]>([]);
  /** Window ids from bottom to top. */
  private readonly _stack = signal<readonly string[]>([]);
  private readonly _snapPreview = signal<SnapPreview | null>(null);
  private readonly _size = signal<Size>({ width: 0, height: 0 });
  private readonly _shownCount = signal(0);
  private readonly _layoutPicker = signal<LayoutPicker | null>(null);
  private layoutPickerTimer: ReturnType<typeof setTimeout> | undefined;
  /** Windows minimized by `toggleShowDesktop()`, bottom to top. */
  private readonly _hiddenForDesktop = signal<readonly DesktopWindow[]>([]);
  /** The last measurement was 0 × 0 (the desktop is hidden). */
  private measuredHidden = false;

  /** Replaced by `DesktopComponent` with its inputs. */
  settings: DesktopSettings = {
    snapToZones: signal(true),
    snapToWindows: signal(true),
    snapThreshold: signal(DEFAULT_SNAP_THRESHOLD),
    snapPadding: signal(0),
    allowOverlap: signal(true),
    snapLayouts: signal(true),
  };

  readonly windows = this._windows.asReadonly();
  readonly openWindows = computed(() => this._windows().filter((w) => w.visible()));
  /** Open windows that get a dock tab (widgets do not). */
  readonly dockWindows = computed(() => this.openWindows().filter((w) => w.dockable()));
  /** The dock's tabs: open windows (not widgets) and closed `pinned` ones, in the order they were added. */
  readonly dockTabs = computed(() => this._windows().filter((w) => w.dockable() && (w.visible() || w.pinned())));
  readonly focusedId = computed(() => {
    const stack = this._stack();
    return stack.length ? stack[stack.length - 1] : null;
  });
  /** Size of the desktop; changes whenever the desktop element is resized. */
  readonly size = this._size.asReadonly();
  /**
   * Goes up whenever the desktop is measured visible after being hidden, or at a new size.
   * Unlike `size`, it also changes when a hidden desktop is shown again at the same size.
   */
  readonly shownCount = this._shownCount.asReadonly();
  /** Where a dragged window would snap to; shown as an overlay by the desktop. */
  readonly snapPreview = this._snapPreview.asReadonly();
  /** The open snap layouts flyout, rendered by the desktop. */
  readonly layoutPicker = this._layoutPicker.asReadonly();
  /** Whether `toggleShowDesktop()` hid windows that are still minimized. */
  readonly showingDesktop = computed(() =>
    this._hiddenForDesktop().some((w) => w.visible() && w.minimized() && this._windows().includes(w))
  );

  attachContainer(element: HTMLElement): void {
    this.container = element;
  }

  /** The area windows live in, in container coordinates. */
  bounds(): Rect {
    return {
      x: 0,
      y: 0,
      width: this.container?.clientWidth ?? 0,
      height: this.container?.clientHeight ?? 0,
    };
  }

  /**
   * Re-reads the container size; called by the desktop when its element is resized.
   * A hidden desktop measures 0 × 0; that is ignored, so windows keep their size until it is shown again.
   */
  updateSize(): void {
    if (this.isHidden()) {
      this.measuredHidden = true;
      return;
    }
    const { width, height } = this.bounds();
    const current = this._size();
    const resized = current.width !== width || current.height !== height;
    if (resized) this._size.set({ width, height });
    if (resized || this.measuredHidden) this._shownCount.update((count) => count + 1);
    this.measuredHidden = false;
  }

  /** Whether the desktop is hidden right now (`display: none`, an inactive tab…): it measures 0 × 0. */
  isHidden(): boolean {
    const { width, height } = this.bounds();
    return width === 0 || height === 0;
  }

  /** Lets the dock tell where the tab of a window is. Returns a function that unregisters it. */
  registerDockLocator(locator: (id: string) => HTMLElement | null): () => void {
    this.dockLocator = locator;
    return () => {
      if (this.dockLocator === locator) this.dockLocator = null;
    };
  }

  /** The dock tab element of a window, or `null` when it has none. */
  dockTab(id: string): HTMLElement | null {
    return this.dockLocator?.(id) ?? null;
  }

  /** The dock tab of a window, in container coordinates, or `null` when it has none. */
  dockTabRect(id: string): Rect | null {
    const tab = this.dockTab(id);
    if (!tab) return null;
    const box = tab.getBoundingClientRect();
    const { x, y } = this.toLocal(box.left, box.top);
    return { x, y, width: box.width, height: box.height };
  }

  /** Converts viewport (client) coordinates to container coordinates. */
  toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const container = this.container;
    if (!container) return { x: clientX, y: clientY };
    // Windows are positioned inside the border, so the border is not part of the desktop area.
    const origin = container.getBoundingClientRect();
    return { x: clientX - origin.left - container.clientLeft, y: clientY - origin.top - container.clientTop };
  }

  /** Rects of the windows a window can snap to: every other window that is on screen and not maximized. */
  otherRects(id: string): Rect[] {
    const rects: Rect[] = [];
    for (const window of this._windows()) {
      const rect = window.rect();
      if (window.id !== id && rect && window.visible() && !window.minimized() && !window.maximized()) {
        rects.push(rect);
      }
    }
    return rects;
  }

  showSnapPreview(preview: SnapPreview | null): void {
    this._snapPreview.set(preview);
  }

  register(window: DesktopWindow): void {
    this._windows.update((windows) => [...windows, window]);
    this._stack.update((stack) => [...stack, window.id]);
  }

  unregister(id: string): void {
    this._windows.update((windows) => windows.filter((w) => w.id !== id));
    this._stack.update((stack) => stack.filter((s) => s !== id));
    if (this._layoutPicker()?.window.id === id) this.closeLayoutPicker();
  }

  openLayoutPicker(picker: LayoutPicker): void {
    clearTimeout(this.layoutPickerTimer);
    this._layoutPicker.set(picker);
  }

  /** Closes the snap layouts; with a window id, only when they belong to that window. */
  closeLayoutPicker(windowId?: string): void {
    const picker = this._layoutPicker();
    if (!picker || (windowId && picker.window.id !== windowId)) return;
    clearTimeout(this.layoutPickerTimer);
    this._layoutPicker.set(null);
  }

  /** The pointer left the maximize button or the flyout: close unless it comes back in time. */
  closeLayoutPickerSoon(): void {
    clearTimeout(this.layoutPickerTimer);
    if (!this._layoutPicker()) return;
    this.layoutPickerTimer = setTimeout(() => this.closeLayoutPicker(), LAYOUT_PICKER_CLOSE_DELAY);
  }

  /** The pointer came back: keep the snap layouts open. */
  keepLayoutPicker(): void {
    clearTimeout(this.layoutPickerTimer);
  }

  /** Brings a window to the top of the stack. */
  focus(id: string): void {
    this._stack.update((stack) =>
      stack.includes(id) && stack.at(-1) !== id ? [...stack.filter((s) => s !== id), id] : stack
    );
  }

  /** Shows a window (from minimized or closed) and brings it to the front. Unknown ids are ignored. */
  focusWindow(id: string): void {
    this._windows()
      .find((w) => w.id === id)
      ?.restore();
  }

  /** Minimizes every open window that can be (widgets stay); returns the ones it minimized, bottom to top. */
  minimizeAll(): DesktopWindow[] {
    const minimized = this.byStack(this.dockWindows()).filter((w) => !w.minimized() && w.minimizable());
    for (const window of minimized) window.minimize();
    return minimized;
  }

  /** Restores every minimized window, keeping their stacking order. */
  restoreAll(): void {
    this._hiddenForDesktop.set([]);
    for (const window of this.byStack(this.openWindows())) {
      if (window.minimized()) window.restore();
    }
  }

  /** Minimizes all windows; the next call restores the ones it minimized (and that are still minimized). */
  toggleShowDesktop(): void {
    if (this.showingDesktop()) {
      const hidden = this._hiddenForDesktop();
      this._hiddenForDesktop.set([]);
      for (const window of hidden) {
        if (window.visible() && window.minimized()) window.restore();
      }
    } else {
      this._hiddenForDesktop.set(this.minimizeAll());
    }
  }

  /** Closes every open window and widget that is `closable`. */
  closeAll(): void {
    for (const window of this.openWindows()) {
      if (window.closable()) window.close();
    }
  }

  /**
   * Arranges the open windows and/or widgets (never minimized windows) over the desktop in the order they
   * were added, keeping `snapPadding` between them. When overlap is not allowed, the tiles also make room
   * for open items that are not being arranged. Returns how many were arranged.
   */
  tile(mode: TileMode = 'auto', include: ArrangeTarget = 'all'): number {
    const items = this.arrangeable(include);
    if (!items.length || this.isHidden()) return 0;
    const bounds = this.bounds();
    const gap = this.settings.snapPadding();
    const rects = tileRects(items.length, bounds, mode, gap);
    const obstacles = this.settings.allowOverlap()
      ? []
      : this.openWindows()
          .filter((w) => !w.minimized() && !items.includes(w))
          .map((w) => w.rect())
          .filter((rect): rect is Rect => !!rect);
    const placed: Rect[] = [];
    items.forEach((item, i) => {
      const minSize = { width: item.minWidth(), height: item.minHeight() };
      const rect = obstacles.length
        ? (fitWithoutOverlap(rects[i], [...obstacles, ...placed], bounds, minSize, gap) ?? rects[i])
        : rects[i];
      item.place(rect);
      placed.push(item.rect() ?? rect);
    });
    return items.length;
  }

  /**
   * Stacks the open windows and/or widgets (never minimized windows) diagonally from the top-left, in
   * stacking order; each keeps its size unless it would stick out. Cascaded items overlap, so nothing
   * happens when the desktop does not allow overlap. Returns how many were arranged.
   */
  cascade(include: ArrangeTarget = 'all'): number {
    if (!this.settings.allowOverlap()) return 0;
    const items = this.byStack(this.arrangeable(include));
    if (!items.length || this.isHidden()) return 0;
    const sizes = items.map((w) => {
      const rect = w.rect();
      return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
    });
    const rects = cascadeRects(sizes, this.bounds(), CASCADE_STEP, this.settings.snapPadding());
    items.forEach((item, i) => item.place(rects[i]));
    return items.length;
  }

  /** What tile and cascade move: open, not minimized, and windows and/or widgets as asked. */
  private arrangeable(include: ArrangeTarget): DesktopWindow[] {
    return this.openWindows().filter(
      (w) => !w.minimized() && (include === 'all' || (include === 'widgets') === w.widget())
    );
  }

  /** The windows sorted bottom to top. */
  private byStack(windows: readonly DesktopWindow[]): DesktopWindow[] {
    const stack = this._stack();
    return [...windows].sort((a, b) => stack.indexOf(a.id) - stack.indexOf(b.id));
  }

  /** Reactive z-index of a window; read it inside a computed or template. */
  zIndex(id: string): number {
    return this.config.zIndex.window + Math.max(this._stack().indexOf(id), 0);
  }
}
