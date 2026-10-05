/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DESKTOP_LABELS } from '../../config/desktop-labels';
import { WindowFooterDirective, WindowHeaderDirective } from '../../directives/window-slots.directive';
import { DesktopTheme } from '../../models/types';
import { uniqueId } from '../../utils/unique-id';
import { CloseIconComponent } from '../icons/close-icon/close-icon.component';
import { DialogStack } from './dialog-stack';
import { USER_HAS_INTERACTED } from './user-activation';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * @publicApi
 * @description
 * A centered dialog with an optional modal overlay. Shares its look with `<omni-window>`
 * but is not draggable or resizable.
 *
 * Keyboard:
 * - When it opens, focus moves to the first control in its content or footer, or to the dialog itself.
 * - A non-modal dialog does that only once the user has interacted with the page, so a dialog that
 *   is open while the page loads does not take focus. A modal dialog always does.
 * - While it is modal, Tab stays inside it.
 * - When it closes, focus goes back to where it was.
 * - Escape closes the topmost open dialog only.
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
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class DialogComponent {
  private readonly document = inject(DOCUMENT);
  private readonly stack = inject(DialogStack);
  private readonly userHasInteracted = inject(USER_HAS_INTERACTED);
  private readonly config = inject(DESKTOP_CONFIG);
  protected readonly labels = inject(DESKTOP_LABELS);
  protected readonly zIndex = this.config.zIndex.dialog;
  protected readonly titleId = uniqueId('omni-dialog-title-');

  readonly header = input('');
  readonly theme = input<DesktopTheme>();
  /** Dims the page behind the dialog, blocks interaction with it and keeps keyboard focus inside the dialog. */
  readonly modal = input(false, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closeOnEscape = input(true, { transform: booleanAttribute });

  readonly visible = model(true);
  /** Emitted when the dialog is closed by its close button or Escape. */
  readonly closed = output<void>();

  protected readonly customHeader = contentChild(WindowHeaderDirective);
  protected readonly customFooter = contentChild(WindowFooterDirective);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** The rendered panel while the dialog is open, and the element that had focus before it opened. */
  private openPanel: HTMLElement | null = null;
  private returnFocus: HTMLElement | null = null;

  protected readonly hostClasses = computed(() => {
    const theme = this.theme();
    return {
      'omni-dialog-host': true,
      'omni-dialog-modal': this.modal() && this.visible(),
      'omni-motion-system': this.config.motion === 'system',
      'omni-motion-full': this.config.motion === 'full',
      'omni-motion-none': this.config.motion === 'none',
      [`omni-theme-${theme}`]: !!theme,
    };
  });

  constructor() {
    // Runs after rendering, so the panel exists (or is gone) when focus is moved.
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement ?? null;
      // A modal dialog always takes focus. A non-modal one does once the user has interacted with the
      // page (it was opened in response to them); before that it leaves focus where it is.
      if (panel && panel !== this.openPanel) this.onOpened(panel, untracked(this.modal) || this.userHasInteracted());
      if (!panel && this.openPanel) this.onClosed();
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.openPanel) this.onClosed();
    });
  }

  close(): void {
    if (!this.visible()) return;
    this.visible.set(false);
    this.closed.emit();
  }

  protected onEscape(event: Event): void {
    if (!this.visible() || !this.closable() || !this.closeOnEscape()) return;
    if (this.stack.claim(event, this)) this.close();
  }

  /** Keeps Tab inside a modal dialog. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.modal() || !this.openPanel) return;
    const focusable = this.focusable(this.openPanel);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === this.openPanel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private onOpened(panel: HTMLElement, takeFocus: boolean): void {
    this.openPanel = panel;
    this.stack.push(this);
    if (!takeFocus) return;
    const active = this.document.activeElement;
    this.returnFocus = active instanceof HTMLElement && active !== this.document.body ? active : null;
    // Prefer a control in the content or footer over the header's close button.
    const focusable = this.focusable(panel);
    const target = focusable.find((element) => !element.closest('.omni-window-header')) ?? focusable[0] ?? panel;
    target.focus();
  }

  private onClosed(): void {
    this.openPanel = null;
    this.stack.remove(this);
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) target.focus();
  }

  private focusable(panel: HTMLElement): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.closest('[hidden]'));
  }
}
