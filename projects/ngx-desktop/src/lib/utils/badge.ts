/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

/** @internal A badge worth showing (`null`, `undefined`, `''` and `0` show nothing), or `null`. */
export function shownBadge(badge: string | number | null | undefined): string | number | null {
  return badge === null || badge === undefined || badge === '' || badge === 0 ? null : badge;
}
