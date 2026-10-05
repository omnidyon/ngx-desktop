/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { WindowLayout } from './window-layout';

/**
 * @publicApi
 * @description
 * Where window layouts are kept. The default is IndexedDB ({@link IndexedDbLayoutStorage});
 * implement this interface and register it with `provideDesktopLayoutStorage()` to keep layouts
 * somewhere else, for example on your backend per user.
 */
export interface DesktopLayoutStorage {
  /** The saved layout for `key`, or `null` when there is none. */
  load(key: string): Promise<WindowLayout | null>;
  save(key: string, layout: WindowLayout): Promise<void>;
  remove(key: string): Promise<void>;
  /** Removes every saved layout. */
  clear(): Promise<void>;
}

/**
 * @publicApi
 * @description
 * Keeps layouts in memory for the lifetime of the page. Useful in tests, for server-side
 * rendering, and as the fallback when IndexedDB is not available.
 */
export class InMemoryLayoutStorage implements DesktopLayoutStorage {
  private readonly entries = new Map<string, WindowLayout>();

  async load(key: string): Promise<WindowLayout | null> {
    const layout = this.entries.get(key);
    return layout ? structuredClone(layout) : null;
  }

  async save(key: string, layout: WindowLayout): Promise<void> {
    this.entries.set(key, structuredClone(layout));
  }

  async remove(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}
