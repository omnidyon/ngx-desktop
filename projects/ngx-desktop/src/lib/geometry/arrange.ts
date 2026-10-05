/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, Size, TileMode } from '../models/types';

/**
 * @internal
 * @description
 * Cells for `count` windows tiled over the bounds, `gap` px apart and from the edges:
 * - `'auto'`: a grid of ⌈√count⌉ columns; a last row with fewer windows shares the full width
 * - `'columns'`: side by side
 * - `'rows'`: stacked
 */
export function tileRects(count: number, bounds: Rect, mode: TileMode, gap = 0): Rect[] {
  if (count <= 0) return [];
  const columns = mode === 'columns' ? count : mode === 'rows' ? 1 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const height = Math.floor((bounds.height - gap * (rows + 1)) / rows);

  const rects: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = row < rows - 1 ? columns : count - columns * (rows - 1);
    const width = Math.floor((bounds.width - gap * (inRow + 1)) / inRow);
    for (let column = 0; column < inRow; column++) {
      rects.push({
        x: bounds.x + gap + column * (width + gap),
        y: bounds.y + gap + row * (height + gap),
        width,
        height,
      });
    }
  }
  return rects;
}

/**
 * @internal
 * @description
 * Cascaded rects for windows of the given sizes: each one `step` px right of and below the
 * previous, starting `gap` px inside the bounds. A window that would stick out is shrunk to fit;
 * once the cascade reaches half-way across or down the bounds, a new one starts at the top-left.
 */
export function cascadeRects(sizes: readonly Size[], bounds: Rect, step: number, gap = 0): Rect[] {
  const maxWidth = Math.max(bounds.width - 2 * gap, 0);
  const maxHeight = Math.max(bounds.height - 2 * gap, 0);
  let offset = 0;
  return sizes.map((size) => {
    if (offset > 0 && (offset > maxWidth / 2 || offset > maxHeight / 2)) offset = 0;
    const width = Math.min(size.width, maxWidth - offset);
    const height = Math.min(size.height, maxHeight - offset);
    const rect = { x: bounds.x + gap + offset, y: bounds.y + gap + offset, width, height };
    offset += step;
    return rect;
  });
}
