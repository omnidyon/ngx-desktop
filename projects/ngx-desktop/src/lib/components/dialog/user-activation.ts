/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken } from '@angular/core';

interface NavigatorWithUserActivation {
  userActivation?: { hasBeenActive: boolean };
}

/**
 * @internal
 * @description
 * Whether the user has interacted with the page yet (clicked, tapped or typed), from the browser's
 * User Activation API. Dialogs opened before that (while the page loads, or by code on its own) do not
 * pull keyboard focus away unless they are modal. Browsers without the API count as interacted.
 * A token so tests can control it.
 */
export const USER_HAS_INTERACTED = new InjectionToken<() => boolean>('USER_HAS_INTERACTED', {
  providedIn: 'root',
  factory: () => () =>
    (globalThis.navigator as NavigatorWithUserActivation | undefined)?.userActivation?.hasBeenActive ?? true,
});
