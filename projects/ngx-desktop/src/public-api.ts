/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

/*
 * Public API Surface of @omnidyon/ngx-desktop
 */
export * from './lib/models/types';
export * from './lib/config/desktop-config';
export * from './lib/config/desktop-labels';
export type { Length } from './lib/geometry/length';
export type { WindowLayout } from './lib/persistence/window-layout';
export * from './lib/persistence/layout-storage';
export * from './lib/persistence/indexed-db-layout-storage';
export * from './lib/persistence/layout-storage.provider';
export * from './lib/session/session-storage';
export * from './lib/session/desktop-session';
export * from './lib/directives/draggable.directive';
export * from './lib/directives/window-slots.directive';
export * from './lib/directives/dock-tab.directive';
export * from './lib/components/window/window.component';
export * from './lib/components/desktop/desktop.component';
export * from './lib/components/desktop/inject-desktop';
export * from './lib/components/dialog/dialog.component';
