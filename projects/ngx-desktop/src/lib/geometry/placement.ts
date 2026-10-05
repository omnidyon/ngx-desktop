/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, Size, WindowPosition } from '../models/types';
import { clampRect } from './rect';

/**
 * @internal
 * @description
 * Computes the initial rectangle of a window of the given size placed at a named
 * position inside the bounds. The result is clamped to the bounds.
 */
export function placeRect(position: WindowPosition, size: Size, bounds: Rect): Rect {
  const freeX = bounds.width - size.width;
  const freeY = bounds.height - size.height;
  const offsets: Record<WindowPosition, [number, number]> = {
    topleft: [0, 0],
    top: [freeX / 2, 0],
    topright: [freeX, 0],
    left: [0, freeY / 2],
    center: [freeX / 2, freeY / 2],
    right: [freeX, freeY / 2],
    bottomleft: [0, freeY],
    bottom: [freeX / 2, freeY],
    bottomright: [freeX, freeY],
  };
  const [dx, dy] = offsets[position];
  return clampRect(
    { x: bounds.x + Math.round(dx), y: bounds.y + Math.round(dy), width: size.width, height: size.height },
    bounds
  );
}
