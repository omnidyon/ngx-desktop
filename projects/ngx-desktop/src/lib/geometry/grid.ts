/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, ResizeDirection, Size } from '../models/types';

/** The nearest grid line to `value`; lines are `size` px apart, starting at `origin`. */
function toGrid(value: number, size: number, origin: number): number {
  return origin + Math.round((value - origin) / size) * size;
}

/**
 * @internal
 * @description
 * Moves a rect so its top-left corner sits on the grid (lines `size` px apart from the bounds' origin).
 * The size does not change.
 */
export function gridMove(rect: Rect, size: number, bounds: Rect): Rect {
  return { ...rect, x: toGrid(rect.x, size, bounds.x), y: toGrid(rect.y, size, bounds.y) };
}

/**
 * @internal
 * @description
 * Puts the edges being resized on the grid. An edge that would make the rect smaller than `min` or
 * larger than `max` stays where it was.
 */
export function gridResize(
  rect: Rect,
  direction: ResizeDirection,
  size: number,
  bounds: Rect,
  min: Size,
  max: Size
): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  const fits = (length: number, low: number, high: number) => length >= low && length <= high;

  if (direction.includes('w')) {
    const snapped = toGrid(left, size, bounds.x);
    if (fits(right - snapped, min.width, max.width)) left = snapped;
  }
  if (direction.includes('e')) {
    const snapped = toGrid(right, size, bounds.x);
    if (fits(snapped - left, min.width, max.width)) right = snapped;
  }
  if (direction.includes('n')) {
    const snapped = toGrid(top, size, bounds.y);
    if (fits(bottom - snapped, min.height, max.height)) top = snapped;
  }
  if (direction.includes('s')) {
    const snapped = toGrid(bottom, size, bounds.y);
    if (fits(snapped - top, min.height, max.height)) bottom = snapped;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
