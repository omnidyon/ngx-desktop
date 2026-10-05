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
 * Resize grip icon, shown in the bottom-right corner of a resizable window.
 */
@Component({
  selector: 'omni-resize-icon',
  templateUrl: './resize-icon.component.html',
  styleUrl: './resize-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResizeIconComponent {}
