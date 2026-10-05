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
 * Full-screen icon.
 */
@Component({
  selector: 'omni-full-screen-icon',
  templateUrl: './full-screen-icon.component.html',
  styleUrl: './full-screen-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullScreenIconComponent {}
