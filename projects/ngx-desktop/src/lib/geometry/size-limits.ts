/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Rect, Size, SnapZone } from '../models/types';

/**
 * @internal
 * @description
 * Keeps a rect's size between the minimum and the maximum (the minimum wins if they conflict).
 * The position is kept.
 */
export function limitSize(rect: Rect, min: Size, max: Size): Rect {
  return {
    ...rect,
    width: Math.max(Math.min(rect.width, max.width), min.width),
    height: Math.max(Math.min(rect.height, max.height), min.height),
  };
}

/** Zones against the right edge of the desktop. */
const RIGHT_ZONES: readonly SnapZone[] = [
  'right',
  'topright',
  'bottomright',
  'rightthird',
  'righttwothirds',
  'toprightthird',
  'bottomrightthird',
];

/**
 * @internal
 * @description
 * Fits a window with a maximum size into a snap zone: it is shrunk to the maximum and kept against
 * the zone's outer side (the left half stays at the left edge, the bottom-right quarter in the
 * bottom-right corner, the middle third in the middle, and so on).
 */
export function limitZoneRect(zone: SnapZone, rect: Rect, max: Size): Rect {
  const width = Math.min(rect.width, max.width);
  const height = Math.min(rect.height, max.height);
  const alignRight = RIGHT_ZONES.includes(zone);
  const alignBottom = zone === 'bottomleft' || zone === 'bottomright' || zone === 'bottomrightthird';
  const x = alignRight
    ? rect.x + rect.width - width
    : zone === 'centerthird'
      ? rect.x + Math.round((rect.width - width) / 2)
      : rect.x;
  return {
    x,
    y: alignBottom ? rect.y + rect.height - height : rect.y,
    width,
    height,
  };
}
