import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowFooterDirective } from '../../directives/window-slots.directive';
import { DesktopTheme } from '../../models/types';
import { DialogComponent } from './dialog.component';
import { USER_HAS_INTERACTED } from './user-activation';

/** A modal dialog with only text and no close button: nothing inside it can take focus. */
@Component({
  imports: [DialogComponent],
  template: `<omni-dialog header="Info" [modal]="true" [closable]="false"><p>Just text.</p></omni-dialog>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PlainDialogHostComponent {}

/** A non-modal dialog the app creates later, in response to a user action. */
@Component({
  imports: [DialogComponent],
  template: `
    @if (show()) {
      <omni-dialog header="Later"><input class="later-field" /></omni-dialog>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CreatedLaterHostComponent {
  readonly show = signal(false);
}

/** Dialogs that are already open when the page renders. */
@Component({
  imports: [DialogComponent],
  template: `<omni-dialog header="On load" [modal]="modal"><input class="load-field" /></omni-dialog>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class OpenOnLoadHostComponent {
  modal = false;
}

@Component({
  imports: [DialogComponent, WindowFooterDirective],
  template: `
    <omni-dialog
      header="Confirm"
      [theme]="theme()"
      [modal]="modal()"
      [closable]="closable()"
      [closeOnEscape]="closeOnEscape()"
      [(visible)]="visible"
      (closed)="closedCount = closedCount + 1"
    >
      <p class="body">Are you sure? <input class="field" /></p>
      @if (footer()) {
        <div omniWindowFooter class="actions">OK</div>
      }
    </omni-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly theme = signal<DesktopTheme | undefined>(undefined);
  readonly modal = signal(false);
  readonly closable = signal(true);
  readonly closeOnEscape = signal(true);
  readonly footer = signal(false);
  readonly visible = signal(true);
  closedCount = 0;
}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const query = (selector: string): HTMLElement | null => element.querySelector<HTMLElement>(selector);
  const stable = () => fixture.whenStable();
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await stable();
  });

  it('renders header, content and an accessible name', () => {
    const dialog = query('.omni-dialog')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    const title = query(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent?.trim()).toBe('Confirm');
    expect(query('.body')).not.toBeNull();
  });

  it('closes with the close button', async () => {
    query('.omni-window-button[aria-label="Close"]')!.click();
    await stable();
    expect(host.visible()).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('closes on Escape', async () => {
    escape();
    await stable();
    expect(host.visible()).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('ignores Escape when closeOnEscape is off or it is not closable', async () => {
    host.closeOnEscape.set(false);
    await stable();
    escape();
    host.closeOnEscape.set(true);
    host.closable.set(false);
    await stable();
    escape();
    await stable();
    expect(host.visible()).toBe(true);
    expect(host.closedCount).toBe(0);
    expect(query('.omni-window-button[aria-label="Close"]')).toBeNull();
  });

  it('does not emit closed again when already hidden', async () => {
    host.visible.set(false);
    await stable();
    escape();
    expect(host.closedCount).toBe(0);
  });

  it('renders the overlay only when modal', async () => {
    expect(query('.omni-dialog-overlay')).toBeNull();
    host.modal.set(true);
    await stable();
    expect(query('.omni-dialog-overlay')).not.toBeNull();
    expect(query('.omni-dialog')?.getAttribute('aria-modal')).toBe('true');
  });

  it('only shows the footer when footer content is projected', async () => {
    expect((query('.omni-window-footer') as HTMLElement).hidden).toBe(true);
    host.footer.set(true);
    await stable();
    expect((query('.omni-window-footer') as HTMLElement).hidden).toBe(false);
  });

  describe('focus', () => {
    it('moves focus into the dialog content when it opens and back when it closes', async () => {
      host.visible.set(false);
      await stable();
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();

      host.visible.set(true);
      await stable();
      expect(document.activeElement).toBe(query('.field'));

      escape();
      await stable();
      expect(document.activeElement).toBe(opener);
      opener.remove();
    });

    it('focuses the dialog itself when it has nothing focusable', async () => {
      const plain = TestBed.createComponent(PlainDialogHostComponent);
      await plain.whenStable();
      const panel = (plain.nativeElement as HTMLElement).querySelector('.omni-dialog');
      expect(document.activeElement).toBe(panel);
    });

    it('takes focus when a non-modal dialog is created after the page has loaded', async () => {
      const later = TestBed.createComponent(CreatedLaterHostComponent);
      await later.whenStable();
      later.componentInstance.show.set(true);
      await later.whenStable();
      expect(document.activeElement).toBe((later.nativeElement as HTMLElement).querySelector('.later-field'));
    });

    it('keeps Tab inside a modal dialog', async () => {
      host.modal.set(true);
      host.footer.set(true);
      await stable();
      const panel = query('.omni-dialog')!;
      const closeButton = query('.omni-window-button[aria-label="Close"]') as HTMLElement;
      const field = query('.field') as HTMLElement;
      const tab = (shiftKey = false) => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        document.activeElement!.dispatchEvent(event);
        return event;
      };

      field.focus();
      // field is the last focusable element (the footer only has text): Tab wraps to the close button.
      expect(tab().defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(closeButton);
      expect(tab(true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(field);
      expect(panel.contains(document.activeElement)).toBe(true);
    });

    it('does not trap Tab when not modal', async () => {
      const field = query('.field') as HTMLElement;
      field.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      field.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  it('applies the theme class and the dialog z-index', async () => {
    host.theme.set('twitch');
    await stable();
    const dialogHost = query('omni-dialog')!;
    expect(dialogHost.classList).toContain('omni-theme-twitch');
    expect(dialogHost.style.zIndex).toBe('2000');
  });
});

/** Dialogs that are open before the user has interacted with the page (e.g. while it loads). */
describe('DialogComponent open on page load', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: USER_HAS_INTERACTED, useValue: () => false }] });
  });

  it('does not take focus when a non-modal dialog is already open on page load', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const onLoad = TestBed.createComponent(OpenOnLoadHostComponent);
    await onLoad.whenStable();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('takes focus when a modal dialog is already open on page load', async () => {
    const onLoad = TestBed.createComponent(OpenOnLoadHostComponent);
    onLoad.componentInstance.modal = true;
    await onLoad.whenStable();
    expect(document.activeElement).toBe((onLoad.nativeElement as HTMLElement).querySelector('.load-field'));
  });
});
