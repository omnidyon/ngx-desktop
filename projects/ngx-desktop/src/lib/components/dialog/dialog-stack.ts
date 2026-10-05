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
 * Open dialogs, in the order they were opened. Only the topmost one reacts to Escape, and each
 * Escape key press is handled by one dialog only (every dialog listens on the document).
 */
@Injectable({ providedIn: 'root' })
export class DialogStack {
  private readonly open: object[] = [];
  private readonly handled = new WeakSet<Event>();

  push(dialog: object): void {
    this.remove(dialog);
    this.open.push(dialog);
  }

  remove(dialog: object): void {
    const index = this.open.indexOf(dialog);
    if (index >= 0) this.open.splice(index, 1);
  }

  isTop(dialog: object): boolean {
    return this.open.length > 0 && this.open[this.open.length - 1] === dialog;
  }

  /** `true` when `dialog` is on top and nobody handled `event` yet; marks it as handled. */
  claim(event: Event, dialog: object): boolean {
    if (this.handled.has(event) || !this.isTop(dialog)) return false;
    this.handled.add(event);
    return true;
  }
}
