/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * @internal
 * @description
 * Maximize icon; shows a restore glyph when `restore` is true.
 */
@Component({
  selector: 'omni-maximize-icon',
  templateUrl: './maximize-icon.component.html',
  styleUrl: './maximize-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaximizeIconComponent {
  readonly restore = input(false);
}
