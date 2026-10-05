/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, ResizeDirection, Size } from '../models/types';

/**
 * @internal
 * @description
 * Resizes a rectangle from one edge or corner by the pointer delta.
 * The opposite edge stays fixed, the minimum and maximum sizes are respected and, when bounds
 * are given, the moving edges never leave them.
 */
export function resizeRect(
  start: Rect,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  minSize: Size,
  bounds?: Rect,
  maxSize: Size = { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }
): Rect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (direction.includes('w')) {
    left = Math.max(Math.min(left + dx, right - minSize.width), right - maxSize.width);
    if (bounds) left = Math.max(left, bounds.x);
  }
  if (direction.includes('e')) {
    right = Math.min(Math.max(right + dx, left + minSize.width), left + maxSize.width);
    if (bounds) right = Math.min(right, bounds.x + bounds.width);
  }
  if (direction.includes('n')) {
    top = Math.max(Math.min(top + dy, bottom - minSize.height), bottom - maxSize.height);
    if (bounds) top = Math.max(top, bounds.y);
  }
  if (direction.includes('s')) {
    bottom = Math.min(Math.max(bottom + dy, top + minSize.height), top + maxSize.height);
    if (bounds) bottom = Math.min(bottom, bounds.y + bounds.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
