/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

/**
 * @publicApi
 * @description
 * A length in pixels (`120`, `'120'`, `'120px'`) or a percentage of the desktop / viewport (`'25%'`).
 */
export type Length = number | string;

const LENGTH = /^\s*(-?\d+(?:\.\d+)?)\s*(px|%)?\s*$/;

/**
 * @internal
 * @description
 * Converts a {@link Length} to pixels; percentages are taken of `total`.
 * Returns `undefined` for missing or unparseable values.
 */
export function resolveLength(value: Length | null | undefined, total: number): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const match = LENGTH.exec(value);
  if (!match) return undefined;
  const amount = parseFloat(match[1]);
  return match[2] === '%' ? Math.round((total * amount) / 100) : amount;
}
