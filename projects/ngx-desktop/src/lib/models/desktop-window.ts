/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Signal } from '@angular/core';
import { Rect } from './types';

/**
 * @internal
 * @description
 * What a desktop needs to know about a window registered with it. Implemented by
 * `WindowComponent`; kept as an interface so the service does not import the component.
 */
export interface DesktopWindow {
  readonly id: string;
  readonly header: Signal<string>;
  readonly icon: Signal<string | undefined>;
  readonly visible: Signal<boolean>;
  readonly minimized: Signal<boolean>;
  readonly maximized: Signal<boolean>;
  /** Whether the window gets a dock tab (widgets do not). */
  readonly dockable: Signal<boolean>;
  readonly rect: Signal<Rect | null>;
  restore(): void;
}
