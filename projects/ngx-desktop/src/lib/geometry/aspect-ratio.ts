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
 * The largest size with the given aspect ratio (width ÷ height) that fits in `size`, but never smaller
 * than `min` (the minimum wins, keeping the ratio).
 */
export function fitAspect(size: Size, ratio: number, min: Size = { width: 0, height: 0 }): Size {
  let width = size.width / size.height > ratio ? size.height * ratio : size.width;
  width = Math.max(width, min.width, min.height * ratio);
  return { width: Math.round(width), height: Math.round(width / ratio) };
}

/**
 * @internal
 * @description
 * Makes a resized rect keep the aspect ratio (width ÷ height). The side being dragged decides the size
 * (for a corner, the side that changed more); the other side follows. The opposite edges stay where they
 * are. The result stays within `min` / `max` and, when given, inside `bounds`.
 */
export function keepAspect(
  rect: Rect,
  start: Rect,
  direction: ResizeDirection,
  ratio: number,
  min: Size,
  max: Size,
  bounds?: Rect
): Rect {
  const horizontal = direction.includes('e') || direction.includes('w');
  const vertical = direction.includes('n') || direction.includes('s');
  let width: number;
  if (horizontal && vertical) {
    const changeX = Math.abs(rect.width - start.width) / Math.max(start.width, 1);
    const changeY = Math.abs(rect.height - start.height) / Math.max(start.height, 1);
    width = changeX >= changeY ? rect.width : rect.height * ratio;
  } else {
    width = horizontal ? rect.width : rect.height * ratio;
  }

  const fromRight = direction.includes('w');
  const fromBottom = direction.includes('n');
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  let largest = Math.min(max.width, max.height * ratio);
  if (bounds) {
    const room = fromRight ? right - bounds.x : bounds.x + bounds.width - rect.x;
    const roomBelow = fromBottom ? bottom - bounds.y : bounds.y + bounds.height - rect.y;
    largest = Math.min(largest, room, roomBelow * ratio);
  }
  const smallest = Math.max(min.width, min.height * ratio);
  width = Math.round(Math.max(Math.min(width, largest), smallest));
  const height = Math.round(width / ratio);

  return {
    x: fromRight ? right - width : rect.x,
    y: fromBottom ? bottom - height : rect.y,
    width,
    height,
  };
}
