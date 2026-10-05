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

  private readonly _windows = signal<readonly DesktopWindow[]>([]);
  /** Window ids from bottom to top. */
  private readonly _stack = signal<readonly string[]>([]);
  private readonly _snapPreview = signal<SnapPreview | null>(null);
  private readonly _size = signal<Size>({ width: 0, height: 0 });

  /** Replaced by `DesktopComponent` with its inputs. */
  settings: DesktopSettings = {
    snapToZones: signal(true),
    snapToWindows: signal(true),
    snapThreshold: signal(DEFAULT_SNAP_THRESHOLD),
  };

  readonly windows = this._windows.asReadonly();
  readonly openWindows = computed(() => this._windows().filter((w) => w.visible()));
  readonly focusedId = computed(() => {
    const stack = this._stack();
    return stack.length ? stack[stack.length - 1] : null;
  });
  /** Size of the desktop; changes whenever the desktop element is resized. */
  readonly size = this._size.asReadonly();
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

  /** Re-reads the container size; called by the desktop when its element is resized. */
  updateSize(): void {
    const { width, height } = this.bounds();
    const current = this._size();
    if (current.width !== width || current.height !== height) this._size.set({ width, height });
  }

  /** Converts viewport (client) coordinates to container coordinates. */
  toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const origin = this.container?.getBoundingClientRect();
    return { x: clientX - (origin?.left ?? 0), y: clientY - (origin?.top ?? 0) };
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
