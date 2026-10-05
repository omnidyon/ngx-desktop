/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken, Signal, computed, isSignal, signal } from '@angular/core';

/**
 * @publicApi
 * @description
 * The texts ngx-desktop shows or announces to screen readers. Translate them with
 * `provideDesktopConfig({ labels })`.
 */
export interface DesktopLabels {
  /** Close button of windows, widgets and dialogs. */
  close: string;
  /** Minimize button. */
  minimize: string;
  /** Minimize button while the window is minimized. */
  restore: string;
  /** Maximize button. */
  maximize: string;
  /** Maximize button while the window is maximized. */
  restoreSize: string;
  /** Full-screen button. */
  fullScreen: string;
  /** Full-screen button while the window is full screen. */
  exitFullScreen: string;
  /** The dock (its toolbar name). */
  dock: string;
  /** Dock tab of a window without a header. */
  untitledWindow: string;
}

/**
 * @publicApi
 */
export const DEFAULT_DESKTOP_LABELS: DesktopLabels = {
  close: 'Close',
  minimize: 'Minimize',
  restore: 'Restore',
  maximize: 'Maximize',
  restoreSize: 'Restore size',
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  dock: 'Windows',
  untitledWindow: 'Window',
};

/**
 * @publicApi
 * @description
 * Labels given to `provideDesktopConfig`: fixed texts, or a signal for apps that switch language at runtime.
 * Missing labels fall back to {@link DEFAULT_DESKTOP_LABELS}.
 */
export type DesktopLabelsInput = Partial<DesktopLabels> | Signal<Partial<DesktopLabels>>;

/** @internal Fills in missing labels with the English defaults. */
export function desktopLabels(input: DesktopLabelsInput = {}): Signal<DesktopLabels> {
  const source = isSignal(input) ? input : signal(input);
  return computed(() => ({ ...DEFAULT_DESKTOP_LABELS, ...source() }));
}

/**
 * @publicApi
 * @description
 * Injection token holding the active {@link DesktopLabels}. Use `provideDesktopConfig({ labels })` to change them.
 */
export const DESKTOP_LABELS = new InjectionToken<Signal<DesktopLabels>>('DESKTOP_LABELS', {
  providedIn: 'root',
  factory: () => desktopLabels(),
});
