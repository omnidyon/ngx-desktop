/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { InjectionToken, Provider } from '@angular/core';

/**
 * @publicApi
 * @description
 * How windows, dialogs and the snap preview animate:
 * - `'system'`: animate unless the operating system asks for reduced motion (the default)
 * - `'full'`: always animate
 * - `'none'`: never animate
 */
export type DesktopMotion = 'system' | 'full' | 'none';

/**
 * @publicApi
 * @description
 * Global configuration of ngx-desktop.
 */
export interface DesktopConfig {
  zIndex: {
    /** Base z-index of windows. Each focused window is raised above this. */
    window: number;
    /** z-index of the dock. Should be above all windows. */
    dock: number;
    /** z-index of dialogs and their overlay. */
    dialog: number;
  };
  /** Animations; see {@link DesktopMotion}. */
  motion: DesktopMotion;
}

/**
 * @publicApi
 */
export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  zIndex: { window: 1000, dock: 1500, dialog: 2000 },
  motion: 'system',
};

/**
 * @publicApi
 * @description
 * Injection token holding the active {@link DesktopConfig}. Use {@link provideDesktopConfig} to change it.
 */
export const DESKTOP_CONFIG = new InjectionToken<DesktopConfig>('DESKTOP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_DESKTOP_CONFIG,
});

/**
 * @publicApi
 * @description
 * Overrides parts of the default configuration.
 *
 * @usageNotes
 * bootstrapApplication(App, { providers: [provideDesktopConfig({ zIndex: { window: 500 }, motion: 'full' })] });
 */
export function provideDesktopConfig(config: {
  zIndex?: Partial<DesktopConfig['zIndex']>;
  motion?: DesktopMotion;
}): Provider {
  return {
    provide: DESKTOP_CONFIG,
    useValue: {
      zIndex: { ...DEFAULT_DESKTOP_CONFIG.zIndex, ...config.zIndex },
      motion: config.motion ?? DEFAULT_DESKTOP_CONFIG.motion,
    } satisfies DesktopConfig,
  };
}
