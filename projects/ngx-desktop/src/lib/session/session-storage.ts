/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken, Provider } from '@angular/core';
import { DATABASE_NAME, IndexedDbStore, SESSION_STORE } from '../persistence/indexed-db';

/**
 * @publicApi
 * @description
 * One window of a {@link DesktopSession}: a unique key (also used as the window's `persistKey`)
 * and the app's own data describing it.
 */
export interface SessionWindow<T = unknown> {
  key: string;
  data: T;
}

/**
 * @publicApi
 * @description
 * What a session stores: the windows that exist, in order.
 */
export interface SessionRecord<T = unknown> {
  version: 1;
  windows: SessionWindow<T>[];
}

/**
 * @publicApi
 * @description
 * Where sessions are kept. The default is IndexedDB ({@link IndexedDbSessionStorage}); implement this
 * interface and register it with `provideDesktopSessionStorage()` to keep sessions elsewhere.
 */
export interface DesktopSessionStorage {
  load(key: string): Promise<SessionRecord | null>;
  save(key: string, record: SessionRecord): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * @publicApi
 * @description
 * Keeps sessions in memory for the lifetime of the page; useful in tests and for server-side rendering.
 */
export class InMemorySessionStorage implements DesktopSessionStorage {
  private readonly records = new Map<string, SessionRecord>();

  async load(key: string): Promise<SessionRecord | null> {
    const record = this.records.get(key);
    return record ? structuredClone(record) : null;
  }

  async save(key: string, record: SessionRecord): Promise<void> {
    this.records.set(key, structuredClone(record));
  }

  async remove(key: string): Promise<void> {
    this.records.delete(key);
  }
}

/**
 * @publicApi
 * @description
 * The default {@link DesktopSessionStorage}: the `sessions` object store of the `omni-desktop`
 * IndexedDB database. Falls back to memory (with a single warning) when IndexedDB is not available.
 */
export class IndexedDbSessionStorage implements DesktopSessionStorage {
  private readonly store: IndexedDbStore<SessionRecord>;

  constructor(databaseName = DATABASE_NAME, factory: IDBFactory | undefined = globalThis.indexedDB) {
    this.store = new IndexedDbStore<SessionRecord>(
      SESSION_STORE,
      databaseName,
      factory,
      '[ngx-desktop] IndexedDB is not available; window sessions are kept in memory only.'
    );
  }

  load(key: string): Promise<SessionRecord | null> {
    return this.store.get(key);
  }

  save(key: string, record: SessionRecord): Promise<void> {
    return this.store.put(key, record);
  }

  remove(key: string): Promise<void> {
    return this.store.delete(key);
  }
}

/**
 * @publicApi
 * @description
 * The {@link DesktopSessionStorage} used by `injectDesktopSession()`. Defaults to IndexedDB.
 */
export const DESKTOP_SESSION_STORAGE = new InjectionToken<DesktopSessionStorage>('DESKTOP_SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => new IndexedDbSessionStorage(),
});

/**
 * @publicApi
 * @description
 * Replaces where window sessions are stored.
 */
export function provideDesktopSessionStorage(storage: DesktopSessionStorage): Provider {
  return { provide: DESKTOP_SESSION_STORAGE, useValue: storage };
}
