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

const ZONES: readonly SnapZone[] = ['left', 'right', 'topleft', 'topright', 'bottomleft', 'bottomright', 'maximize'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSize(value: unknown): value is Size {
  const size = value as Size | null;
  return !!size && isFiniteNumber(size.width) && isFiniteNumber(size.height) && size.width > 0 && size.height > 0;
}

/**
 * @internal
 * @description
 * Whether a stored value is a usable {@link WindowLayout}. Stored data may be old, broken, edited by
 * hand or come from a custom backend; anything that is not a valid layout is ignored.
 */
export function isWindowLayout(value: unknown): value is WindowLayout {
  const layout = value as Partial<WindowLayout> | null;
  if (!layout || typeof layout !== 'object' || layout.version !== 1) return false;
  const rect = layout.rect as Rect | undefined;
  return (
    !!rect &&
    isFiniteNumber(rect.x) &&
    isFiniteNumber(rect.y) &&
    isSize(rect) &&
    (layout.zone === null || ZONES.includes(layout.zone as SnapZone)) &&
    (layout.restoreSize === null || isSize(layout.restoreSize)) &&
    typeof layout.minimized === 'boolean' &&
    typeof layout.maximized === 'boolean' &&
    typeof layout.visible === 'boolean'
  );
}
