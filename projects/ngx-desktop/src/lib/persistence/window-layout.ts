/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, Size, SnapZone } from '../models/types';

/**
 * @publicApi
 * @description
 * The saved setup of one window: what `persistKey` stores and restores.
 */
export interface WindowLayout {
  /** Format version, so stored layouts can be migrated later. */
  version: 1;
  /** Position and size, relative to the desktop (or viewport). */
  rect: Rect;
  /** Zone the window was snapped into; re-fitted to the desktop size on restore. */
  zone: SnapZone | null;
  /** Size to go back to when a snapped window is dragged out of its zone. */
  restoreSize: Size | null;
  minimized: boolean;
  maximized: boolean;
  visible: boolean;
}
