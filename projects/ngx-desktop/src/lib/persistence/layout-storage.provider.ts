/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken, Provider } from '@angular/core';
import { IndexedDbLayoutStorage } from './indexed-db-layout-storage';
import { DesktopLayoutStorage } from './layout-storage';

/**
 * @publicApi
 * @description
 * The {@link DesktopLayoutStorage} used by windows with a `persistKey`. Defaults to IndexedDB.
 */
export const DESKTOP_LAYOUT_STORAGE = new InjectionToken<DesktopLayoutStorage>('DESKTOP_LAYOUT_STORAGE', {
  providedIn: 'root',
  factory: () => new IndexedDbLayoutStorage(),
});

/**
 * @publicApi
 * @description
 * Replaces where window layouts are stored.
 *
 * @usageNotes
 * bootstrapApplication(App, { providers: [provideDesktopLayoutStorage(new InMemoryLayoutStorage())] });
 */
export function provideDesktopLayoutStorage(storage: DesktopLayoutStorage): Provider {
  return { provide: DESKTOP_LAYOUT_STORAGE, useValue: storage };
}
