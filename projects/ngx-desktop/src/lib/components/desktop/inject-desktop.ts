/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { inject } from '@angular/core';
import { DesktopComponent } from './desktop.component';

/**
 * @publicApi
 * @description
 * The `<omni-desktop>` around the calling component (for example a toolbar inside a window), to
 * use its API: `windows()`, `focus(id)`, `tile()`, …. Call it in an injection context.
 * Throws when there is no desktop around; pass `{ optional: true }` to get `null` instead.
 *
 * @usageNotes
 * readonly desktop = injectDesktop();
 * tile(): void { this.desktop.tile(); }
 */
export function injectDesktop(): DesktopComponent;
export function injectDesktop(options: { optional: true }): DesktopComponent | null;
export function injectDesktop(options?: { optional?: boolean }): DesktopComponent | null {
  const desktop = inject(DesktopComponent, { optional: true });
  if (!desktop && !options?.optional) {
    throw new Error('[ngx-desktop] injectDesktop() was called outside an <omni-desktop>.');
  }
  return desktop;
}
