/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { DesktopService } from '../../services/desktop.service';
import { DesktopTheme, DockPosition } from '../../models/types';
import { DockComponent } from '../dock/dock.component';

/**
 * @publicApi
 * @description
 * A container for windows. It fills its parent element, keeps the windows inside it,
 * manages their stacking order and shows a dock with a tab per open window.
 * (Replaces `sgm-window-mediator`.)
 *
 * @usageNotes
 * <omni-desktop theme="neo-tokyo" dock="bottom">
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
  private readonly service = inject(DesktopService);

  /** Theme preset for the desktop, its dock and every window in it. */
  readonly theme = input<DesktopTheme>();
  /** Where the dock is shown; `none` hides it. */
  readonly dock = input<DockPosition>('bottom');

  protected readonly dockPosition = computed(() => {
    const dock = this.dock();
    return dock === 'none' ? null : dock;
  });

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return { 'omni-desktop': true, [`omni-theme-${theme}`]: !!theme };
  });

  constructor() {
    this.service.attachContainer(inject(ElementRef).nativeElement);
  }
}
