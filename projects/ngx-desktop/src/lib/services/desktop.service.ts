/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import { DESKTOP_CONFIG } from '../config/desktop-config';
import { DesktopWindow } from '../models/desktop-window';
import { Rect } from '../models/types';

/**
 * @internal
 * @description
 * Per-desktop registry of windows. Provided by `DesktopComponent`, so every
 * `<omni-desktop>` has its own instance. Tracks registration order (for the dock)
 * and stacking order (for z-index / focus).
 */
@Injectable()
export class DesktopService {
  private readonly config = inject(DESKTOP_CONFIG);
  private container: HTMLElement | null = null;

  private readonly _windows = signal<readonly DesktopWindow[]>([]);
  /** Window ids from bottom to top. */
  private readonly _stack = signal<readonly string[]>([]);

  readonly windows = this._windows.asReadonly();
  readonly openWindows = computed(() => this._windows().filter((w) => w.visible()));
  readonly focusedId = computed(() => {
    const stack = this._stack();
    return stack.length ? stack[stack.length - 1] : null;
  });

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
