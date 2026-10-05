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
  /** Dock tab of a window without a header, and `{name}` in announcements. */
  untitledWindow: string;
  /** Read by screen readers on a focused title bar (or widget grip). */
  keyboardHelp: string;
  /** Announced after a keyboard move; `{name}`, `{x}`, `{y}`. */
  announceMoved: string;
  /** Announced after a keyboard resize; `{name}`, `{width}`, `{height}`. */
  announceResized: string;
  /** Announced after Ctrl+Left; `{name}`. */
  announceSnappedLeft: string;
  /** Announced after Ctrl+Right; `{name}`. */
  announceSnappedRight: string;
  /** Announced after Ctrl+Up; `{name}`. */
  announceMaximized: string;
  /** Announced after Ctrl+Down restores a maximized or snapped window; `{name}`. */
  announceRestored: string;
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
  keyboardHelp:
    'Arrow keys move the window, Shift+arrow keys resize it, Ctrl+arrow keys snap it to the left or right half, maximize, restore or minimize it.',
  announceMoved: '{name} moved to {x}, {y}',
  announceResized: '{name} resized to {width} by {height}',
  announceSnappedLeft: '{name} snapped to the left half',
  announceSnappedRight: '{name} snapped to the right half',
  announceMaximized: '{name} maximized',
  announceRestored: '{name} restored',
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

/** @internal Fills `{key}` placeholders of a label. */
export function formatLabel(label: string, values: Readonly<Record<string, string | number>>): string {
  return label.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
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
