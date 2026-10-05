import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowFooterDirective } from '../../directives/window-slots.directive';
import { DesktopTheme } from '../../models/types';
import { DialogComponent } from './dialog.component';

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
      <p class="body">Are you sure?</p>
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

  it('applies the theme class and the dialog z-index', async () => {
    host.theme.set('twitch');
    await stable();
    const dialogHost = query('omni-dialog')!;
    expect(dialogHost.classList).toContain('omni-theme-twitch');
    expect(dialogHost.style.zIndex).toBe('2000');
  });
});
