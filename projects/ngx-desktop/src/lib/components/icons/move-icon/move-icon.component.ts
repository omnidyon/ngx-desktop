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
 * Move icon, shown in the header of a collapsed window.
 */
@Component({
  selector: 'omni-move-icon',
  templateUrl: './move-icon.component.html',
  styleUrl: './move-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveIconComponent {}
