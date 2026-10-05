/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { WindowFooterDirective, WindowHeaderDirective } from '../../directives/window-slots.directive';
import { DesktopTheme } from '../../models/types';
import { uniqueId } from '../../utils/unique-id';
import { CloseIconComponent } from '../icons/close-icon/close-icon.component';

/**
 * @publicApi
 * @description
 * A centered dialog with an optional modal overlay. Shares its look with `<omni-window>`
 * but is not draggable or resizable.
 *
 * @usageNotes
 * <omni-dialog [(visible)]="open" header="Confirm" [modal]="true">
 *   Are you sure?
 *   <div omniWindowFooter><button (click)="open.set(false)">OK</button></div>
 * </omni-dialog>
 */
@Component({
  selector: 'omni-dialog',
  imports: [CloseIconComponent],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[style.z-index]': 'zIndex',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class DialogComponent {
  protected readonly zIndex = inject(DESKTOP_CONFIG).zIndex.dialog;
  protected readonly titleId = uniqueId('omni-dialog-title-');

  readonly header = input('');
  readonly theme = input<DesktopTheme>();
  /** Dims the page behind the dialog and blocks interaction with it. */
  readonly modal = input(false, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closeOnEscape = input(true, { transform: booleanAttribute });

  readonly visible = model(true);
  /** Emitted when the dialog is closed by its close button or Escape. */
  readonly closed = output<void>();

  protected readonly customHeader = contentChild(WindowHeaderDirective);
  protected readonly customFooter = contentChild(WindowFooterDirective);

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return {
      'omni-dialog-host': true,
      'omni-dialog-modal': this.modal() && this.visible(),
      [`omni-theme-${theme}`]: !!theme,
    };
  });

  close(): void {
    if (!this.visible()) return;
    this.visible.set(false);
    this.closed.emit();
  }

  protected onEscape(): void {
    if (this.closable() && this.closeOnEscape()) this.close();
  }
}
