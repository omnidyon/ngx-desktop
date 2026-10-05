/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { Signal } from '@angular/core';
import { Rect, SnapZone } from './types';

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
  readonly widget: Signal<boolean>;
  readonly persistKey: Signal<string | undefined>;
  readonly minimizable: Signal<boolean>;
  readonly closable: Signal<boolean>;
  readonly minWidth: Signal<number>;
  readonly minHeight: Signal<number>;
  readonly rect: Signal<Rect | null>;
  /** Shows the window (from minimized or closed) and brings it to the front. */
  restore(): void;
  minimize(): void;
  close(): void;
  /** Puts the window at a rect chosen by the desktop (tile, cascade). */
  place(rect: Rect): void;
  /** Snaps the window into a zone (from the snap layouts). */
  snapTo(zone: SnapZone): void;
}
