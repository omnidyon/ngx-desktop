/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, ResizeDirection, Size } from '../models/types';

/** Lines the start edge (left/top) and the end edge (right/bottom) of a moving rect can snap to. */
interface SnapLines {
  start: number[];
  end: number[];
}

/**
 * Collects snap lines on one axis.
 * - flush: my start edge to your end edge (and vice versa), kept `gap` apart
 * - aligned: my start edge to your start edge, my end edge to your end edge, exact
 * - bounds: my start/end edge to the bounds edges, kept `gap` inside
 */
function snapLines(
  moving: Rect,
  others: readonly Rect[],
  bounds: Rect | null,
  threshold: number,
  gap: number,
  axis: 'x' | 'y'
): SnapLines {
  const size = axis === 'x' ? 'width' : 'height';
  const cross = axis === 'x' ? 'y' : 'x';
  const crossSize = axis === 'x' ? 'height' : 'width';
  const lines: SnapLines = bounds
    ? { start: [bounds[axis] + gap], end: [bounds[axis] + bounds[size] - gap] }
    : { start: [], end: [] };

  for (const other of others) {
    // Only windows that are beside (or close to) the moving one on the other axis attract it;
    // a window far above should not pull a window's left edge into line with it.
    const crossDistance = Math.max(
      other[cross] - (moving[cross] + moving[crossSize]),
      moving[cross] - (other[cross] + other[crossSize])
    );
    if (crossDistance > threshold + gap) continue;
    const otherStart = other[axis];
    const otherEnd = other[axis] + other[size];
    lines.start.push(otherEnd + gap, otherStart);
    lines.end.push(otherStart - gap, otherEnd);
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
 * Windows placed side by side ("flush") and the bounds edges keep `gap` px between them;
 * edges that are lined up ("aligned", my left to your left) match exactly.
 * The x and y axes snap independently. The size never changes.
 */
export function magneticMove(
  moving: Rect,
  others: readonly Rect[],
  bounds: Rect | null,
  threshold: number,
  gap = 0
): Rect {
  const x = snapLines(moving, others, bounds, threshold, gap, 'x');
  const y = snapLines(moving, others, bounds, threshold, gap, 'y');
  const dx = closest(
    nearestOffset(moving.x, x.start, threshold),
    nearestOffset(moving.x + moving.width, x.end, threshold)
  );
  const dy = closest(
    nearestOffset(moving.y, y.start, threshold),
    nearestOffset(moving.y + moving.height, y.end, threshold)
  );
  return { ...moving, x: moving.x + dx, y: moving.y + dy };
}

/**
 * @internal
 * @description
 * Magnetic snapping while resizing: only the edges being dragged snap to nearby edges of other
 * windows (or of the bounds), with the same `gap` rules as {@link magneticMove}.
 * A snap that would make the rectangle smaller than `minSize` is skipped.
 */
export function magneticResize(
  rect: Rect,
  direction: ResizeDirection,
  others: readonly Rect[],
  bounds: Rect | null,
  threshold: number,
  minSize: Size,
  gap = 0
): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  const x = snapLines(rect, others, bounds, threshold, gap, 'x');
  const y = snapLines(rect, others, bounds, threshold, gap, 'y');

  if (direction.includes('w')) {
    const offset = nearestOffset(left, x.start, threshold);
    if (offset !== null && right - (left + offset) >= minSize.width) left += offset;
  }
  if (direction.includes('e')) {
    const offset = nearestOffset(right, x.end, threshold);
    if (offset !== null && right + offset - left >= minSize.width) right += offset;
  }
  if (direction.includes('n')) {
    const offset = nearestOffset(top, y.start, threshold);
    if (offset !== null && bottom - (top + offset) >= minSize.height) top += offset;
  }
  if (direction.includes('s')) {
    const offset = nearestOffset(bottom, y.end, threshold);
    if (offset !== null && bottom + offset - top >= minSize.height) bottom += offset;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
