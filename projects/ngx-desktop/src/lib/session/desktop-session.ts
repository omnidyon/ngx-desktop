/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { inject, Signal, signal } from '@angular/core';
import { ForgottenLayouts } from '../persistence/forgotten-layouts';
import { DESKTOP_LAYOUT_STORAGE } from '../persistence/layout-storage.provider';
import { DesktopLayoutStorage } from '../persistence/layout-storage';
import { DESKTOP_SESSION_STORAGE, DesktopSessionStorage, SessionRecord, SessionWindow } from './session-storage';

let fallbackKeyCounter = 0;

function isSessionWindow(value: unknown): value is SessionWindow {
  const window = value as SessionWindow | null;
  return (
    !!window && typeof window === 'object' && typeof window.key === 'string' && window.key !== '' && 'data' in window
  );
}

function uniqueSuffix(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++fallbackKeyCounter}`;
}

/**
 * @publicApi
 * @description
 * A persisted list of windows the app creates at runtime (e.g. "new document" windows).
 * The library remembers which windows exist and their data; the app renders them from
 * {@link DesktopSession.windows}. Give each window `[persistKey]="window.key"` so its
 * position, size and state are restored too.
 *
 * Closing a window with {@link DesktopSession.close} forgets it: it does not come back after a
 * reload and its saved layout is deleted.
 *
 * Window data must be structured-cloneable (plain objects, arrays, strings, numbers, dates…).
 *
 * @usageNotes
 * readonly docs = injectDesktopSession<{ title: string }>('documents');
 *
 * @for (doc of docs.windows(); track doc.key) {
 *   <omni-window [header]="doc.data.title" [persistKey]="doc.key" (closed)="docs.close(doc.key)">…</omni-window>
 * }
 * <button (click)="docs.open({ title: 'Untitled' })">New</button>
 */
export class DesktopSession<T> {
  private readonly _windows = signal<readonly SessionWindow<T>[]>([]);
  private readonly _loaded = signal(false);
  /**
   * Saves run one after another, and only after the saved session was read, so the stored list
   * always ends up as the latest state.
   */
  private writes: Promise<void>;

  /** The windows of the session, in the order they were opened. */
  readonly windows: Signal<readonly SessionWindow<T>[]> = this._windows.asReadonly();
  /** Whether the saved windows have been restored. */
  readonly loaded: Signal<boolean> = this._loaded.asReadonly();

  constructor(
    readonly sessionKey: string,
    private readonly storage: DesktopSessionStorage,
    private readonly layouts: DesktopLayoutStorage,
    private readonly forgotten: ForgottenLayouts
  ) {
    this.writes = this.restore();
  }

  /** Adds a window and returns its key. Without a `key`, a unique one is generated. */
  open(data: T, key = `${this.sessionKey}:${uniqueSuffix()}`): string {
    this.forgotten.revive(key);
    this._windows.update((windows) => [...windows.filter((w) => w.key !== key), { key, data }]);
    this.persist();
    return key;
  }

  /** Replaces the data of a window. Unknown keys are ignored. */
  update(key: string, data: T): void {
    if (!this.has(key)) return;
    this._windows.update((windows) => windows.map((w) => (w.key === key ? { key, data } : w)));
    this.persist();
  }

  /** Removes a window and forgets its saved layout. Unknown keys are ignored. */
  close(key: string): void {
    if (!this.has(key)) return;
    this.forget(key);
    this._windows.update((windows) => windows.filter((w) => w.key !== key));
    this.persist();
  }

  /** Closes every window of the session. */
  clear(): void {
    for (const window of this._windows()) this.forget(window.key);
    this._windows.set([]);
    this.persist();
  }

  /**
   * Resolves once every change made so far has been written to storage (or failed with a warning).
   * Await it before reloading or navigating away right after a change.
   */
  whenSaved(): Promise<void> {
    return this.writes;
  }

  private has(key: string): boolean {
    return this._windows().some((w) => w.key === key);
  }

  private forget(key: string): void {
    this.forgotten.forget(key);
    this.layouts.remove(key).catch((error: unknown) => {
      console.warn(`[ngx-desktop] Could not remove the layout "${key}".`, error);
    });
  }

  private async restore(): Promise<void> {
    try {
      const record = (await this.storage.load(this.sessionKey)) as SessionRecord<T> | null;
      if (record?.version === 1 && Array.isArray(record.windows)) {
        // Stored data may be broken, edited by hand or come from a custom backend: keep only valid entries.
        const valid = record.windows.filter(isSessionWindow);
        if (valid.length !== record.windows.length) {
          console.warn(
            `[ngx-desktop] Ignored ${record.windows.length - valid.length} invalid window(s) in the session "${this.sessionKey}".`
          );
        }
        // Windows opened before loading finished stay, after the restored ones.
        const opened = this._windows();
        const restored = (valid as SessionWindow<T>[]).filter((w) => !opened.some((o) => o.key === w.key));
        this._windows.set([...restored, ...opened]);
      }
    } catch (error) {
      console.warn(`[ngx-desktop] Could not load the session "${this.sessionKey}".`, error);
    }
    this._loaded.set(true);
  }

  private persist(): void {
    this.writes = this.writes
      // Snapshot when the save runs, not when it was requested: a change made before the saved
      // session finished loading must not overwrite the restored windows.
      .then(() => {
        const record: SessionRecord<T> = { version: 1, windows: [...this._windows()] };
        return this.storage.save(this.sessionKey, record as SessionRecord);
      })
      .catch((error: unknown) => {
        console.warn(`[ngx-desktop] Could not save the session "${this.sessionKey}".`, error);
      });
  }
}

/**
 * @publicApi
 * @description
 * Creates a {@link DesktopSession}. Call it in an injection context, typically a component field.
 * Each `sessionKey` should be used by one session at a time.
 */
export function injectDesktopSession<T>(sessionKey: string): DesktopSession<T> {
  return new DesktopSession<T>(
    sessionKey,
    inject(DESKTOP_SESSION_STORAGE),
    inject(DESKTOP_LAYOUT_STORAGE),
    inject(ForgottenLayouts)
  );
}
