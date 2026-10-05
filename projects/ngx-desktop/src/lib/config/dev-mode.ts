/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken, isDevMode } from '@angular/core';

/**
 * @internal
 * @description
 * Whether development-only warnings are shown. A token (rather than calling `isDevMode()`
 * directly) so tests can switch it.
 */
export const DESKTOP_DEV_MODE = new InjectionToken<boolean>('DESKTOP_DEV_MODE', {
  providedIn: 'root',
  factory: () => isDevMode(),
});
