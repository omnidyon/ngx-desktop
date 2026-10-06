/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Directive, inject, TemplateRef } from '@angular/core';

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

/**
 * @publicApi
 * @description
 * Content of an `<omni-window>` (or widget) that exists only while the window is shown: it is created
 * when the window is first opened and destroyed when the window is closed or minimized (after the
 * closing animation), then created again on restore. Use it for content that costs something while it
 * lives, such as a chart polling an API. Its state is lost when it is destroyed.
 *
 * @usageNotes
 * <omni-window header="Sales">
 *   <ng-template omniWindowContent><app-sales-chart /></ng-template>
 * </omni-window>
 */
@Directive({ selector: 'ng-template[omniWindowContent]' })
export class WindowContentDirective {
  readonly template = inject(TemplateRef);
}
