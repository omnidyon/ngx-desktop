/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { DesktopLayoutStorage, InMemoryLayoutStorage } from './layout-storage';
import { WindowLayout } from './window-layout';

const STORE = 'window-layouts';

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
  private readonly databaseName: string;
  private readonly factory: IDBFactory | undefined;
  private database: Promise<IDBDatabase | null> | null = null;
  private fallback: InMemoryLayoutStorage | null = null;

  constructor(databaseName = 'omni-desktop', factory: IDBFactory | undefined = globalThis.indexedDB) {
    this.databaseName = databaseName;
    this.factory = factory;
  }

  async load(key: string): Promise<WindowLayout | null> {
    const result = await this.request<WindowLayout | undefined>(
      'readonly',
      (store) => store.get(key),
      async (memory) => (await memory.load(key)) ?? undefined
    );
    return result ?? null;
  }

  async save(key: string, layout: WindowLayout): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.put(layout, key),
      (memory) => memory.save(key, layout)
    );
  }

  async remove(key: string): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.delete(key),
      (memory) => memory.remove(key)
    );
  }

  async clear(): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.clear(),
      (memory) => memory.clear()
    );
  }

  /** Runs one request against the object store, or against the in-memory fallback. */
  private async request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
    fallback: (memory: InMemoryLayoutStorage) => Promise<T>
  ): Promise<T> {
    const database = await this.open();
    if (!database) return fallback(this.memory());
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private open(): Promise<IDBDatabase | null> {
    this.database ??= new Promise<IDBDatabase | null>((resolve) => {
      if (!this.factory) return resolve(null);
      try {
        const request = this.factory.open(this.databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.database;
  }

  private memory(): InMemoryLayoutStorage {
    if (!this.fallback) {
      console.warn('[ngx-desktop] IndexedDB is not available; window layouts are kept in memory only.');
      this.fallback = new InMemoryLayoutStorage();
    }
    return this.fallback;
  }
}
