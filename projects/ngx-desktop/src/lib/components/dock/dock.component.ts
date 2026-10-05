/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DESKTOP_LABELS } from '../../config/desktop-labels';
import { DesktopWindow } from '../../models/desktop-window';
import { DesktopService } from '../../services/desktop.service';

/**
 * @internal
 * @description
 * The taskbar of a desktop: one tab per open window. A tab restores its window when it
 * is minimized and brings it to the front otherwise. Rendered by `<omni-desktop>`.
 *
 * The dock is a single tab stop; arrow keys move between its tabs (wrapping around), Home / End go to
 * the first / last tab (the ARIA toolbar pattern).
 */
@Component({
  selector: 'omni-dock',
  templateUrl: './dock.component.html',
  styleUrl: './dock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    '[attr.aria-label]': 'labels().dock',
    '[class]': 'hostClasses()',
    '[style.z-index]': 'zIndex',
  },
})
export class DockComponent {
  protected readonly desktop = inject(DesktopService);
  protected readonly zIndex = inject(DESKTOP_CONFIG).zIndex.dock;
  protected readonly labels = inject(DESKTOP_LABELS);

  readonly position = input<'top' | 'bottom'>('bottom');

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    // Windows fly into their tab when minimized, so the desktop needs to find it.
    const unregister = this.desktop.registerDockLocator((id) =>
      element.querySelector<HTMLElement>(`[data-window-id="${id}"]`)
    );
    inject(DestroyRef).onDestroy(unregister);
  }

  /** The tab focused last; it stays the dock's tab stop while it exists. */
  private readonly lastFocusedId = signal<string | null>(null);

  /** The one tab in the tab order: the last focused one, else the focused window's, else the first. */
  protected readonly tabStopId = computed(() => {
    const ids = this.desktop.dockWindows().map((window) => window.id);
    const last = this.lastFocusedId();
    if (last && ids.includes(last)) return last;
    const focused = this.desktop.focusedId();
    return focused && ids.includes(focused) ? focused : (ids[0] ?? null);
  });

  protected readonly hostClasses = computed(() => ({
    'omni-dock': true,
    [`omni-dock-${this.position()}`]: true,
    'omni-dock-empty': this.desktop.dockWindows().length === 0,
  }));

  protected activate(window: DesktopWindow): void {
    window.restore();
  }

  protected onTabFocus(window: DesktopWindow): void {
    this.lastFocusedId.set(window.id);
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const tabs = this.desktop.dockWindows();
    const count = tabs.length;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.desktop.dockTab(tabs[next].id)?.focus();
  }
}
