/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

const BLOCKERS = new WeakMap<Document, Set<string>>();
const PREVIOUS_OVERFLOW = new WeakMap<Document, string>();

/**
 * @internal
 * @description
 * Blocks scrolling of the document body. Several owners can block at the same time;
 * scrolling is restored only when the last owner unblocks.
 */
export function blockBodyScroll(doc: Document, owner: string): void {
  const blockers = BLOCKERS.get(doc) ?? new Set<string>();
  if (blockers.size === 0) {
    PREVIOUS_OVERFLOW.set(doc, doc.body.style.overflow);
    doc.body.style.overflow = 'hidden';
  }
  blockers.add(owner);
  BLOCKERS.set(doc, blockers);
}

/**
 * @internal
 * @description
 * Releases a block placed by {@link blockBodyScroll} for the given owner.
 */
export function unblockBodyScroll(doc: Document, owner: string): void {
  const blockers = BLOCKERS.get(doc);
  if (!blockers?.delete(owner) || blockers.size > 0) return;
  doc.body.style.overflow = PREVIOUS_OVERFLOW.get(doc) ?? '';
  PREVIOUS_OVERFLOW.delete(doc);
}
