/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DesktopWindow } from '../../models/desktop-window';
import { DesktopService } from '../../services/desktop.service';

/**
 * @internal
 * @description
 * The taskbar of a desktop: one tab per open window. A tab restores its window when it
 * is minimized and brings it to the front otherwise. Rendered by `<omni-desktop>`.
 */
@Component({
  selector: 'omni-dock',
  templateUrl: './dock.component.html',
  styleUrl: './dock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    'aria-label': 'Windows',
    '[class]': 'hostClasses()',
    '[style.z-index]': 'zIndex',
  },
})
export class DockComponent {
  protected readonly desktop = inject(DesktopService);
  protected readonly zIndex = inject(DESKTOP_CONFIG).zIndex.dock;

  readonly position = input<'top' | 'bottom'>('bottom');

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    // Windows fly into their tab when minimized, so the desktop needs to find it.
    const unregister = this.desktop.registerDockLocator((id) => element.querySelector(`[data-window-id="${id}"]`));
    inject(DestroyRef).onDestroy(unregister);
  }

  protected readonly hostClasses = computed(() => ({
    'omni-dock': true,
    [`omni-dock-${this.position()}`]: true,
    'omni-dock-empty': this.desktop.dockWindows().length === 0,
  }));

  protected activate(window: DesktopWindow): void {
    window.restore();
  }
}
