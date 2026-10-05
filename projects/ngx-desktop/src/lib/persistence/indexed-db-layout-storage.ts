/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { DATABASE_NAME, IndexedDbStore, LAYOUT_STORE } from './indexed-db';
import { DesktopLayoutStorage } from './layout-storage';
import { WindowLayout } from './window-layout';

/**
 * @publicApi
 * @description
 * The default {@link DesktopLayoutStorage}: keeps layouts in the browser's IndexedDB
 * (database `omni-desktop`, object store `window-layouts`, one entry per `persistKey`).
 *
 * When IndexedDB is not available or cannot be opened (server-side rendering, some private
 * browsing modes, blocked storage) it falls back to memory and logs a single warning, so a
 * storage problem never breaks the windows themselves.
 */
export class IndexedDbLayoutStorage implements DesktopLayoutStorage {
  private readonly store: IndexedDbStore<WindowLayout>;

  constructor(databaseName = DATABASE_NAME, factory: IDBFactory | undefined = globalThis.indexedDB) {
    this.store = new IndexedDbStore<WindowLayout>(
      LAYOUT_STORE,
      databaseName,
      factory,
      '[ngx-desktop] IndexedDB is not available; window layouts are kept in memory only.'
    );
  }

  load(key: string): Promise<WindowLayout | null> {
    return this.store.get(key);
  }

  save(key: string, layout: WindowLayout): Promise<void> {
    return this.store.put(key, layout);
  }

  remove(key: string): Promise<void> {
    return this.store.delete(key);
  }

  clear(): Promise<void> {
    return this.store.clear();
  }
}
