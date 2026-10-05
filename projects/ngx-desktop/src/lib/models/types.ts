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
 * Container zones a window can be snapped into. Halves, quarters and `maximize` are reached by dragging to
 * an edge or corner; every zone except `maximize` is offered by the snap layouts of the maximize button.
 */
export type SnapZone =
  | 'left'
  | 'right'
  | 'topleft'
  | 'topright'
  | 'bottomleft'
  | 'bottomright'
  | 'leftthird'
  | 'centerthird'
  | 'rightthird'
  | 'lefttwothirds'
  | 'righttwothirds'
  | 'toprightthird'
  | 'bottomrightthird'
  | 'maximize';

/**
 * @publicApi
 * @description
 * The zones of the snap layouts (every zone except `maximize`).
 */
export type LayoutZone = Exclude<SnapZone, 'maximize'>;

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

/**
 * @publicApi
 * @description
 * How `tile()` arranges windows: `'auto'` a grid, `'columns'` side by side, `'rows'` stacked.
 */
export type TileMode = 'auto' | 'columns' | 'rows';

/**
 * @publicApi
 * @description
 * What `tile()` and `cascade()` arrange: everything open (`'all'`, the default), only windows, or only widgets.
 */
export type ArrangeTarget = 'all' | 'windows' | 'widgets';

/**
 * @publicApi
 */
export interface ArrangeOptions {
  /** What to arrange; see {@link ArrangeTarget}. Minimized windows are never moved. */
  include?: ArrangeTarget;
}

/**
 * @publicApi
 * @description
 * A window of a desktop, as listed by `DesktopComponent.windows()`.
 */
export interface DesktopWindowInfo {
  /** Generated id; pass it to `focus(id)`. */
  readonly id: string;
  readonly header: string;
  /** `false` once closed. */
  readonly visible: boolean;
  readonly minimized: boolean;
  readonly maximized: boolean;
  /** Position and size in px relative to the desktop; `null` until placed. */
  readonly rect: Rect | null;
  readonly widget: boolean;
  readonly persistKey: string | undefined;
}
