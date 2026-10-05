/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Injectable } from '@angular/core';

/**
 * @internal
 * @description
 * Layout keys that were deliberately forgotten (`session.close()`, `window.forgetLayout()`).
 * A window that is being destroyed still flushes its pending layout save; this registry keeps
 * that last save from bringing a forgotten layout back.
 */
@Injectable({ providedIn: 'root' })
export class ForgottenLayouts {
  private readonly keys = new Set<string>();

  forget(key: string): void {
    this.keys.add(key);
  }

  /** The key is in use again (e.g. a new window with the same key). */
  revive(key: string): void {
    this.keys.delete(key);
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }
}
