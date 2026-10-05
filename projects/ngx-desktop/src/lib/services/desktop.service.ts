/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { DESKTOP_CONFIG } from '../config/desktop-config';
import { DesktopWindow } from '../models/desktop-window';
import { Rect, Size } from '../models/types';

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
}

/** @internal */
export const DEFAULT_SNAP_THRESHOLD = 16;

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
  private dockLocator: ((id: string) => Element | null) | null = null;

  private readonly _windows = signal<readonly DesktopWindow[]>([]);
  /** Window ids from bottom to top. */
  private readonly _stack = signal<readonly string[]>([]);
  private readonly _snapPreview = signal<SnapPreview | null>(null);
  private readonly _size = signal<Size>({ width: 0, height: 0 });
  private readonly _shownCount = signal(0);
  /** The last measurement was 0 × 0 (the desktop is hidden). */
  private measuredHidden = false;

  /** Replaced by `DesktopComponent` with its inputs. */
  settings: DesktopSettings = {
    snapToZones: signal(true),
    snapToWindows: signal(true),
    snapThreshold: signal(DEFAULT_SNAP_THRESHOLD),
    snapPadding: signal(0),
    allowOverlap: signal(true),
  };

  readonly windows = this._windows.asReadonly();
  readonly openWindows = computed(() => this._windows().filter((w) => w.visible()));
  /** Open windows that get a dock tab (widgets do not). */
  readonly dockWindows = computed(() => this.openWindows().filter((w) => w.dockable()));
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
  registerDockLocator(locator: (id: string) => Element | null): () => void {
    this.dockLocator = locator;
    return () => {
      if (this.dockLocator === locator) this.dockLocator = null;
    };
  }

  /** The dock tab of a window, in container coordinates, or `null` when it has none. */
  dockTabRect(id: string): Rect | null {
    const tab = this.dockLocator?.(id);
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
  }

  /** Brings a window to the top of the stack. */
  focus(id: string): void {
    this._stack.update((stack) => (stack.includes(id) ? [...stack.filter((s) => s !== id), id] : stack));
  }

  /** Reactive z-index of a window; read it inside a computed or template. */
  zIndex(id: string): number {
    return this.config.zIndex.window + Math.max(this._stack().indexOf(id), 0);
  }
}
