/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, ResizeDirection, Size } from '../models/types';
import { clampRect, intersects } from './rect';

/** Grows a rect by `gap` on every side, so whatever must avoid it also keeps the gap. */
function inflate(rect: Rect, gap: number): Rect {
  return { x: rect.x - gap, y: rect.y - gap, width: rect.width + 2 * gap, height: rect.height + 2 * gap };
}

function overlapsAny(rect: Rect, obstacles: readonly Rect[]): boolean {
  return obstacles.some((obstacle) => intersects(rect, obstacle));
}

function distance(a: Rect, b: Rect): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * The maximal empty rectangles of `bounds` once the obstacles are cut out of it:
 * every obstacle splits each free rect it touches into the parts left, right, above and below it,
 * and free rects that lie inside another one are dropped.
 */
function freeRects(bounds: Rect, obstacles: readonly Rect[]): Rect[] {
  let free: Rect[] = [bounds];
  for (const obstacle of obstacles) {
    const next: Rect[] = [];
    for (const rect of free) {
      if (!intersects(rect, obstacle)) {
        next.push(rect);
        continue;
      }
      const right = rect.x + rect.width;
      const bottom = rect.y + rect.height;
      const oRight = obstacle.x + obstacle.width;
      const oBottom = obstacle.y + obstacle.height;
      if (obstacle.x > rect.x) next.push({ ...rect, width: obstacle.x - rect.x });
      if (oRight < right) next.push({ ...rect, x: oRight, width: right - oRight });
      if (obstacle.y > rect.y) next.push({ ...rect, height: obstacle.y - rect.y });
      if (oBottom < bottom) next.push({ ...rect, y: oBottom, height: bottom - oBottom });
    }
    free = dropContained(next);
  }
  return free;
}

/** Removes rects that lie inside another rect of the list (keeping one copy of duplicates). */
function dropContained(rects: readonly Rect[]): Rect[] {
  return rects.filter((rect, i) =>
    rects.every((other, j) => {
      if (j === i || !contains(other, rect)) return true;
      // `other` covers `rect`; drop `rect` unless they are identical and `rect` comes first.
      return contains(rect, other) && i < j;
    })
  );
}

/**
 * @internal
 * @description
 * Finds where `target` can go without overlapping any of the `others`, keeping `gap` px between
 * windows. The moved window adjusts; the others never move.
 *
 * 1. Inside the bounds and free → `target` itself.
 * 2. Otherwise the closest spot of the same size, flush against the windows it would overlap
 *    (left/right/above/below, and the corners between them).
 * 3. Otherwise the nearest free area, with the window shrunk to fit it (never below `minSize`).
 * 4. Otherwise `null`: there is no room.
 */
export function fitWithoutOverlap(
  target: Rect,
  others: readonly Rect[],
  bounds: Rect,
  minSize: Size,
  gap = 0
): Rect | null {
  const wanted = clampRect(target, bounds);
  const obstacles = others.map((other) => inflate(other, gap));
  if (!overlapsAny(wanted, obstacles)) return wanted;

  // Same size: try every combination of "flush against an obstacle edge" on both axes.
  const xs = new Set([wanted.x]);
  const ys = new Set([wanted.y]);
  for (const obstacle of obstacles) {
    xs.add(obstacle.x - wanted.width).add(obstacle.x + obstacle.width);
    ys.add(obstacle.y - wanted.height).add(obstacle.y + obstacle.height);
  }
  let best: Rect | null = null;
  for (const x of xs) {
    for (const y of ys) {
      const candidate = { ...wanted, x, y };
      if (!contains(bounds, candidate) || overlapsAny(candidate, obstacles)) continue;
      if (!best || distance(candidate, wanted) < distance(best, wanted)) best = candidate;
    }
  }
  if (best) return best;

  // Smaller: the nearest free area that still fits the minimum size.
  let shrunk: Rect | null = null;
  for (const free of freeRects(bounds, obstacles)) {
    if (free.width < minSize.width || free.height < minSize.height) continue;
    const width = Math.min(wanted.width, free.width);
    const height = Math.min(wanted.height, free.height);
    const candidate = clampRect({ x: wanted.x, y: wanted.y, width, height }, free);
    if (!shrunk || distance(candidate, wanted) < distance(shrunk, wanted)) shrunk = candidate;
  }
  return shrunk;
}

/**
 * @internal
 * @description
 * Stops the edges being dragged in a resize at the first window in their way (keeping `gap`).
 * Windows the rect already overlapped when the resize started are ignored, so a window that
 * overlaps from before can still be resized.
 */
export function limitResize(
  rect: Rect,
  start: Rect,
  direction: ResizeDirection,
  others: readonly Rect[],
  gap = 0
): Rect {
  const obstacles = others.map((other) => inflate(other, gap)).filter((obstacle) => !intersects(start, obstacle));
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  // Horizontal edges first, against obstacles beside the start rect…
  const beside = obstacles.filter((o) => o.y < start.y + start.height && start.y < o.y + o.height);
  for (const o of beside) {
    if (direction.includes('e') && o.x >= start.x + start.width) right = Math.min(right, o.x);
    if (direction.includes('w') && o.x + o.width <= start.x) left = Math.max(left, o.x + o.width);
  }
  // …then vertical edges, against obstacles above/below the (horizontally limited) rect.
  const stacked = obstacles.filter((o) => o.x < right && left < o.x + o.width);
  for (const o of stacked) {
    if (direction.includes('s') && o.y >= start.y + start.height) bottom = Math.min(bottom, o.y);
    if (direction.includes('n') && o.y + o.height <= start.y) top = Math.max(top, o.y + o.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
