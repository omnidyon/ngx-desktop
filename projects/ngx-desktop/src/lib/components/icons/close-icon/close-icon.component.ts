/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * @internal
 * @description
 * Close (X) icon.
 */
@Component({
  selector: 'omni-close-icon',
  templateUrl: './close-icon.component.html',
  styleUrl: './close-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseIconComponent {}
