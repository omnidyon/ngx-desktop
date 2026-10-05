/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect } from '../models/types';

/**
 * @internal
 * @description
 * Keeps a rectangle inside the given bounds. The rectangle is shifted first; if it is
 * larger than the bounds it is also shrunk to fit.
 */
export function clampRect(rect: Rect, bounds: Rect): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  const x = Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

/**
 * @internal
 * @description
 * Moves a rectangle by the given delta, optionally keeping it inside bounds.
 */
export function moveRect(start: Rect, dx: number, dy: number, bounds?: Rect): Rect {
  const moved = { ...start, x: start.x + dx, y: start.y + dy };
  return bounds ? clampRect(moved, bounds) : moved;
}
