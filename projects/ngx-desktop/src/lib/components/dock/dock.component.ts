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
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { formatLabel } from '../../config/desktop-labels';
import { DockTabContext } from '../../models/types';
import { shownBadge } from '../../utils/badge';
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
  imports: [NgTemplateOutlet],
  templateUrl: './dock.component.html',
  styleUrl: './dock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    '[attr.aria-label]': 'labels().dock',
    '[attr.aria-orientation]': 'vertical() ? "vertical" : "horizontal"',
    '[class]': 'hostClasses()',
    '[style.z-index]': 'zIndex',
  },
})
export class DockComponent {
  protected readonly desktop = inject(DesktopService);
  protected readonly zIndex = inject(DESKTOP_CONFIG).zIndex.dock;
  protected readonly labels = inject(DESKTOP_LABELS);

  readonly position = input<'top' | 'bottom' | 'left' | 'right'>('bottom');
  /** Custom inside of each tab, from `<ng-template omniDockTab>`. */
  readonly tabTemplate = input<TemplateRef<{ $implicit: DockTabContext }> | null>(null);

  protected readonly vertical = computed(() => this.position() === 'left' || this.position() === 'right');

  /** What each tab shows, for the default tab and for a custom template. */
  protected readonly tabs = computed(() =>
    this.desktop.dockTabs().map((window) => {
      const closed = !window.visible();
      const context: DockTabContext = {
        id: window.id,
        header: window.header(),
        icon: window.icon(),
        badge: shownBadge(window.badge()),
        minimized: window.minimized() && !closed,
        focused: this.desktop.focusedId() === window.id && !window.minimized() && !closed,
        closed,
        pinned: window.pinned(),
      };
      return { window, context, label: this.tabLabel(context) };
    })
  );

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
    const ids = this.desktop.dockTabs().map((window) => window.id);
    const last = this.lastFocusedId();
    if (last && ids.includes(last)) return last;
    const focused = this.desktop.focusedId();
    return focused && ids.includes(focused) ? focused : (ids[0] ?? null);
  });

  protected readonly hostClasses = computed(() => ({
    'omni-dock': true,
    [`omni-dock-${this.position()}`]: true,
    'omni-dock-empty': this.desktop.dockTabs().length === 0,
  }));

  protected activate(window: DesktopWindow): void {
    window.restore();
  }

  /** "Mail (3)", "Mail, closed": the header with the badge and closed state screen readers should hear. */
  private tabLabel(tab: DockTabContext): string {
    const labels = this.labels();
    let label = tab.header || labels.untitledWindow;
    if (tab.badge !== null) label = formatLabel(labels.dockTabBadge, { name: label, badge: tab.badge });
    if (tab.closed) label = formatLabel(labels.dockTabClosed, { name: label });
    return label;
  }

  protected onTabFocus(window: DesktopWindow): void {
    this.lastFocusedId.set(window.id);
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const tabs = this.desktop.dockTabs();
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
