/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { DESKTOP_DEV_MODE } from '../../config/dev-mode';
import { DEFAULT_SNAP_THRESHOLD, DesktopService } from '../../services/desktop.service';
import { DesktopTheme, DockPosition } from '../../models/types';
import { DockComponent } from '../dock/dock.component';

/**
 * @publicApi
 * @description
 * A container for windows. It fills its parent element, keeps the windows inside it,
 * manages their stacking order, shows a dock with a tab per open window and snaps
 * windows into place while they are dragged. (Replaces `sgm-window-mediator`.)
 *
 * Snapping:
 * - **Zones** (`snapToZones`): drag a window with the pointer to the left/right edge to fill
 *   that half, to a corner for a quarter, to the top edge to maximize. A preview shows the target.
 *   Dragging a snapped window out again restores its previous size.
 * - **Windows** (`snapToWindows`): edges within `snapThreshold` px of another window's edge
 *   (or the desktop's edge) line up with it, while moving and while resizing.
 * - **Padding** (`snapPadding`): gap in px kept around and between zone-snapped windows,
 *   between windows lined up side by side and between windows and the desktop edges.
 *
 * Overlap (`allowOverlap`, default `true`): when `false`, a window that is moved, resized, snapped,
 * opened or restored onto another one adjusts to fit beside it (keeping `snapPadding` as the gap);
 * the other windows never move. Maximize and full screen are exempt.
 *
 * @usageNotes
 * <omni-desktop theme="neo-tokyo" dock="bottom" [snapThreshold]="20">
 *   <omni-window header="Win 1" position="topleft">...</omni-window>
 *   <omni-window header="Win 2" position="right">...</omni-window>
 * </omni-desktop>
 */
@Component({
  selector: 'omni-desktop',
  imports: [DockComponent],
  providers: [DesktopService],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
  },
})
export class DesktopComponent {
  protected readonly service = inject(DesktopService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly devMode = inject(DESKTOP_DEV_MODE);

  /** Theme preset for the desktop, its dock and every window in it. */
  readonly theme = input<DesktopTheme>();
  /** Where the dock is shown; `none` hides it. */
  readonly dock = input<DockPosition>('bottom');
  /** Snap windows to halves, quarters or maximized when dragged to an edge or corner. */
  readonly snapToZones = input(true, { transform: booleanAttribute });
  /** Line window edges up with nearby edges of other windows and the desktop. */
  readonly snapToWindows = input(true, { transform: booleanAttribute });
  /** Distance in px at which edges and zones attract a window. */
  readonly snapThreshold = input(DEFAULT_SNAP_THRESHOLD, { transform: numberAttribute });
  /** Gap in px kept around and between snapped windows. */
  readonly snapPadding = input(0, { transform: numberAttribute });
  /** When `false`, windows are kept from overlapping: the window being placed adjusts to fit. */
  readonly allowOverlap = input(true, { transform: booleanAttribute });

  protected readonly dockPosition = computed(() => {
    const dock = this.dock();
    return dock === 'none' ? null : dock;
  });

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return { 'omni-desktop': true, [`omni-theme-${theme}`]: !!theme };
  });

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    this.service.attachContainer(element);
    this.service.settings = {
      snapToZones: this.snapToZones,
      snapToWindows: this.snapToWindows,
      snapThreshold: this.snapThreshold,
      snapPadding: this.snapPadding,
      allowOverlap: this.allowOverlap,
    };

    // Windows re-fit when the desktop changes size (layout changes, not only viewport resizes).
    afterNextRender(() => {
      this.service.updateSize();
      this.warnIfSizeless(element);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.service.updateSize());
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /**
   * A desktop that is on the page but has no width or height (usually a parent without a height)
   * looks hidden, so its windows wait forever. Say so once, in development builds only. Desktops
   * hidden on purpose (`display: none`, an inactive tab) have no offsetParent and are not reported.
   */
  private warnIfSizeless(element: HTMLElement): void {
    if (!this.devMode || !this.service.isHidden() || element.offsetParent === null) return;
    console.warn(
      '[ngx-desktop] <omni-desktop> has no width or height, so its windows wait until it gets one. ' +
        'It fills its parent: give the parent a size (for example height: 100vh).',
      element
    );
  }
}
