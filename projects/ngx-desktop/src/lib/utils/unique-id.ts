/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

let lastId = 0;

/**
 * @internal
 * @description
 * Returns an id that is unique for the lifetime of the page.
 */
export function uniqueId(prefix = 'omni-id-'): string {
  lastId++;
  return `${prefix}${lastId}`;
}
