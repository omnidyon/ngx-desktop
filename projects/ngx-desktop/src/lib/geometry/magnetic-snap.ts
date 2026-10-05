/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, ResizeDirection, Size } from '../models/types';

/** Edge lines a moving rectangle can snap to on one axis. */
function snapLines(moving: Rect, others: readonly Rect[], bounds: Rect | null, threshold: number, axis: 'x' | 'y') {
  const size = axis === 'x' ? 'width' : 'height';
  const cross = axis === 'x' ? 'y' : 'x';
  const crossSize = axis === 'x' ? 'height' : 'width';
  const lines: number[] = bounds ? [bounds[axis], bounds[axis] + bounds[size]] : [];

  for (const other of others) {
    // Only windows that are beside (or close to) the moving one on the other axis attract it;
    // a window far above should not pull a window's left edge into line with it.
    const gap = Math.max(
      other[cross] - (moving[cross] + moving[crossSize]),
      moving[cross] - (other[cross] + other[crossSize])
    );
    if (gap <= threshold) lines.push(other[axis], other[axis] + other[size]);
  }
  return lines;
}

/** The smallest offset that moves `value` onto one of the lines, if any is within the threshold. */
function nearestOffset(value: number, lines: readonly number[], threshold: number): number | null {
  let best: number | null = null;
  for (const line of lines) {
    const offset = line - value;
    if (Math.abs(offset) <= threshold && (best === null || Math.abs(offset) < Math.abs(best))) best = offset;
  }
  return best;
}

/** The smaller of two optional offsets, or 0 when neither applies. */
function closest(a: number | null, b: number | null): number {
  if (a === null) return b ?? 0;
  if (b === null) return a;
  return Math.abs(a) <= Math.abs(b) ? a : b;
}

/**
 * @internal
 * @description
 * Magnetic snapping while moving: when an edge of the moving rectangle comes within `threshold`
 * of an edge of another window (or of the bounds), the rectangle is shifted so the edges line up.
 * Both "flush" (my left to your right) and "aligned" (my left to your left) alignments count.
 * The x and y axes snap independently. The size never changes.
 */
export function magneticMove(moving: Rect, others: readonly Rect[], bounds: Rect | null, threshold: number): Rect {
  const xLines = snapLines(moving, others, bounds, threshold, 'x');
  const yLines = snapLines(moving, others, bounds, threshold, 'y');
  const dx = closest(
    nearestOffset(moving.x, xLines, threshold),
    nearestOffset(moving.x + moving.width, xLines, threshold)
  );
  const dy = closest(
    nearestOffset(moving.y, yLines, threshold),
    nearestOffset(moving.y + moving.height, yLines, threshold)
  );
  return { ...moving, x: moving.x + dx, y: moving.y + dy };
}

/**
 * @internal
 * @description
 * Magnetic snapping while resizing: only the edges being dragged snap to nearby edges of other
 * windows (or of the bounds). A snap that would make the rectangle smaller than `minSize` is skipped.
 */
export function magneticResize(
  rect: Rect,
  direction: ResizeDirection,
  others: readonly Rect[],
  bounds: Rect | null,
  threshold: number,
  minSize: Size
): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  const xLines = snapLines(rect, others, bounds, threshold, 'x');
  const yLines = snapLines(rect, others, bounds, threshold, 'y');

  if (direction.includes('w')) {
    const offset = nearestOffset(left, xLines, threshold);
    if (offset !== null && right - (left + offset) >= minSize.width) left += offset;
  }
  if (direction.includes('e')) {
    const offset = nearestOffset(right, xLines, threshold);
    if (offset !== null && right + offset - left >= minSize.width) right += offset;
  }
  if (direction.includes('n')) {
    const offset = nearestOffset(top, yLines, threshold);
    if (offset !== null && bottom - (top + offset) >= minSize.height) top += offset;
  }
  if (direction.includes('s')) {
    const offset = nearestOffset(bottom, yLines, threshold);
    if (offset !== null && bottom + offset - top >= minSize.height) bottom += offset;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
