/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

/**
 * @publicApi
 * @description
 * Initial placement of a window inside its desktop (or the viewport when used standalone).
 */
export type WindowPosition =
  'center' | 'top' | 'bottom' | 'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright';

/**
 * @publicApi
 * @description
 * Built-in theme presets. Each preset reassigns the `--omni-*` CSS variables.
 */
export type DesktopTheme = 'default' | 'aqua' | 'discord' | 'light' | 'neo-san-francisco' | 'neo-tokyo' | 'twitch';

/**
 * @publicApi
 * @description
 * Container zones a window can be snapped into.
 */
export type SnapZone = 'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'maximize';

/**
 * @publicApi
 * @description
 * Where the dock (taskbar) of a desktop is rendered. `none` hides it.
 */
export type DockPosition = 'bottom' | 'top' | 'none';

/**
 * @publicApi
 * @description
 * The edge or corner a window is being resized from.
 */
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * @publicApi
 * @description
 * A width/height pair in pixels.
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * @publicApi
 * @description
 * An axis-aligned rectangle in pixels, relative to the desktop container
 * (or the viewport when a window is used without a desktop).
 */
export interface Rect extends Size {
  x: number;
  y: number;
}
