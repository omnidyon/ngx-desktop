/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Directive, inject, TemplateRef } from '@angular/core';
import { DockTabContext } from '../models/types';

/**
 * @publicApi
 * @description
 * Renders the inside of every dock tab of a desktop. The dock keeps the tab button itself (click,
 * keyboard, focus and labels); the template only draws what is in it.
 *
 * @usageNotes
 * <omni-desktop>
 *   <ng-template omniDockTab let-tab>
 *     <span class="my-tab" [class.closed]="tab.closed">{{ tab.header }}</span>
 *   </ng-template>
 *   ...
 * </omni-desktop>
 */
@Directive({ selector: 'ng-template[omniDockTab]' })
export class DockTabDirective {
  readonly template = inject<TemplateRef<{ $implicit: DockTabContext }>>(TemplateRef);

  // Angular reads the guard only for its type: the parameters are not used at runtime.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  static ngTemplateContextGuard(
    _directive: DockTabDirective,
    _context: unknown
  ): _context is { $implicit: DockTabContext } {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
