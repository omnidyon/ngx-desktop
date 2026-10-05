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
 * Minimize icon; shows a restore (plus) glyph when `restore` is true.
 */
@Component({
  selector: 'omni-minimize-icon',
  templateUrl: './minimize-icon.component.html',
  styleUrl: './minimize-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinimizeIconComponent {
  readonly restore = input(false);
}
