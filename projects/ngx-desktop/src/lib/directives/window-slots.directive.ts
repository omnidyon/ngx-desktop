/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Directive } from '@angular/core';

/**
 * @publicApi
 * @description
 * Marks projected content that replaces the default title (icon + header text)
 * of an `<omni-window>` or `<omni-dialog>`.
 *
 * @usageNotes
 * <omni-window><span omniWindowHeader>Custom <b>title</b></span></omni-window>
 */
@Directive({
  selector: '[omniWindowHeader]',
  host: { class: 'omni-window-header-slot' },
})
export class WindowHeaderDirective {}

/**
 * @publicApi
 * @description
 * Marks projected content rendered in the footer of an `<omni-window>` or `<omni-dialog>`.
 * The footer is only rendered when such content exists.
 *
 * @usageNotes
 * <omni-dialog><div omniWindowFooter><button>OK</button></div></omni-dialog>
 */
@Directive({
  selector: '[omniWindowFooter]',
  host: { class: 'omni-window-footer-slot' },
})
export class WindowFooterDirective {}
