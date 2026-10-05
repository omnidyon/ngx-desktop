/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

/** @internal Database shared by every ngx-desktop store. */
export const DATABASE_NAME = 'omni-desktop';
/**
 * @internal
 * Version history:
 * 1. `window-layouts`
 * 2. `sessions` added
 */
export const DATABASE_VERSION = 2;
/** @internal */
export const LAYOUT_STORE = 'window-layouts';
/** @internal */
export const SESSION_STORE = 'sessions';

const STORES = [LAYOUT_STORE, SESSION_STORE];

/** @internal */
export interface OpenDatabaseOptions {
  /** The connection was closed (another tab upgrades the database, or the browser closed it). */
  onClosed?: () => void;
  /** Opening is blocked by an older connection; this attempt gives up and resolves `null`. */
  onBlocked?: () => void;
}

/**
 * @internal
 * @description
 * Opens (and creates or upgrades) the ngx-desktop database. Resolves `null` when IndexedDB is not
 * available or the database cannot be opened, so callers can fall back to memory.
 */
export function openDesktopDatabase(
  factory: IDBFactory | undefined,
  name = DATABASE_NAME,
  options: OpenDatabaseOptions = {}
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!factory) return resolve(null);
    let settled = false;
    try {
      const request = factory.open(name, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        // Only add what is missing, so data in stores from older versions is kept.
        for (const store of STORES) {
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          // Opened after this attempt gave up (it was blocked): nobody uses it, so do not leak it.
          database.close();
          return;
        }
        settled = true;
        // Let a newer version of the library (e.g. in another tab) upgrade the database.
        database.onversionchange = () => {
          database.close();
          options.onClosed?.();
        };
        database.onclose = () => options.onClosed?.();
        resolve(database);
      };
      request.onerror = () => {
        settled = true;
        resolve(null);
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        options.onBlocked?.();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * @internal
 * @description
 * A small key/value wrapper around one object store of the ngx-desktop database, with an in-memory
 * fallback (and a single warning) when IndexedDB cannot be used.
 */
export class IndexedDbStore<T> {
  private database: Promise<IDBDatabase | null> | null = null;
  private fallback: Map<string, T> | null = null;

  constructor(
    private readonly store: string,
    private readonly databaseName: string,
    private readonly factory: IDBFactory | undefined,
    private readonly fallbackWarning: string
  ) {}

  async get(key: string): Promise<T | null> {
    const value = await this.request<T | undefined>(
      'readonly',
      (store) => store.get(key),
      (memory) => memory.get(key)
    );
    return value === undefined ? null : structuredClone(value);
  }

  async put(key: string, value: T): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.put(value, key),
      (memory) => void memory.set(key, structuredClone(value))
    );
  }

  async delete(key: string): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.delete(key),
      (memory) => void memory.delete(key)
    );
  }

  async clear(): Promise<void> {
    await this.request(
      'readwrite',
      (store) => store.clear(),
      (memory) => memory.clear()
    );
  }

  private async request<R>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
    fallback: (memory: Map<string, T>) => R
  ): Promise<R> {
    const database = await this.open();
    if (!database) return fallback(this.memory());
    return new Promise<R>((resolve, reject) => {
      const transaction = database.transaction(this.store, mode);
      const request = run(transaction.objectStore(this.store));
      transaction.oncomplete = () => resolve(request.result as R);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private open(): Promise<IDBDatabase | null> {
    this.database ??= openDesktopDatabase(this.factory, this.databaseName, {
      // A closed connection cannot be used again: open a new one on the next request.
      onClosed: () => (this.database = null),
      // Blocked by an older connection: this request falls back to memory, the next one tries again.
      onBlocked: () => (this.database = null),
    });
    return this.database;
  }

  private memory(): Map<string, T> {
    if (!this.fallback) {
      console.warn(this.fallbackWarning);
      this.fallback = new Map<string, T>();
    }
    return this.fallback;
  }
}
