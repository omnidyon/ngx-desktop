/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, SnapZone } from '../models/types';

/**
 * @internal
 * @description
 * How much larger than the edge threshold the corner areas are. Corners are hard to hit with
 * a pointer, so a window counts as "in the corner" when the pointer is at a side edge and
 * within this many thresholds of the top or bottom (or the other way round).
 */
export const CORNER_FACTOR = 4;

/**
 * @internal
 * @description
 * Finds the snap zone the pointer is in while dragging a window, Aero-style:
 * - left/right edge → half of the container
 * - near a corner → quarter of the container
 * - top edge → maximize
 * - bottom edge (away from the corners) → no zone
 *
 * A pointer outside the bounds counts as being at the nearest edge.
 */
export function detectZone(pointer: { x: number; y: number }, bounds: Rect, threshold: number): SnapZone | null {
  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const corner = threshold * CORNER_FACTOR;

  const atLeft = pointer.x <= left + threshold;
  const atRight = pointer.x >= right - threshold;
  const atTop = pointer.y <= top + threshold;
  const atBottom = pointer.y >= bottom - threshold;
  const nearTop = pointer.y <= top + corner;
  const nearBottom = pointer.y >= bottom - corner;
  const nearLeft = pointer.x <= left + corner;
  const nearRight = pointer.x >= right - corner;

  if (atLeft || atRight) {
    const side = atLeft ? 'left' : 'right';
    if (nearTop) return `top${side}`;
    if (nearBottom) return `bottom${side}`;
    return side;
  }
  if (atTop) {
    if (nearLeft) return 'topleft';
    if (nearRight) return 'topright';
    return 'maximize';
  }
  if (atBottom) {
    if (nearLeft) return 'bottomleft';
    if (nearRight) return 'bottomright';
  }
  return null;
}

/**
 * @internal
 * @description
 * The rectangle a window takes when snapped into a zone. `padding` is kept free between the
 * zone and the bounds edges and between neighbouring zones (halves/quarters); `maximize`
 * always fills the whole bounds, like the maximize button.
 */
export function zoneRect(zone: SnapZone, bounds: Rect, padding = 0): Rect {
  if (zone === 'maximize') return { ...bounds };

  const p = Math.max(padding, 0);
  // Room left for the two halves once the outer gaps and the gap between them are taken out.
  const innerWidth = Math.max(bounds.width - 3 * p, 0);
  const innerHeight = Math.max(bounds.height - 3 * p, 0);
  const leftWidth = Math.round(innerWidth / 2);
  const topHeight = Math.round(innerHeight / 2);
  const left = { x: bounds.x + p, width: leftWidth };
  const right = { x: bounds.x + 2 * p + leftWidth, width: innerWidth - leftWidth };
  const top = { y: bounds.y + p, height: topHeight };
  const bottom = { y: bounds.y + 2 * p + topHeight, height: innerHeight - topHeight };
  const full = { y: bounds.y + p, height: Math.max(bounds.height - 2 * p, 0) };

  switch (zone) {
    case 'left':
      return { ...left, ...full };
    case 'right':
      return { ...right, ...full };
    case 'topleft':
      return { ...left, ...top };
    case 'topright':
      return { ...right, ...top };
    case 'bottomleft':
      return { ...left, ...bottom };
    case 'bottomright':
      return { ...right, ...bottom };
  }
}
