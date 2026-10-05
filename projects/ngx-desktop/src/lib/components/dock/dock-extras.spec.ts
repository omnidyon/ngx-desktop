import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DockTabDirective } from '../../directives/dock-tab.directive';
import { DockPosition } from '../../models/types';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from '../window/window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop [dock]="dock()">
      <omni-window header="Mail" [badge]="badge()" pinned [width]="200" [height]="100" />
      <omni-window header="Notes" [width]="200" [height]="100" />
      <omni-window header="Clock" widget [width]="100" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly dock = signal<DockPosition>('bottom');
  readonly badge = signal<string | number | null>(3);
}

@Component({
  imports: [DesktopComponent, WindowComponent, DockTabDirective],
  template: `
    <omni-desktop>
      <ng-template omniDockTab let-tab>
        <span class="custom-tab" [class.closed]="tab.closed">{{ tab.header }}·{{ tab.badge }}·{{ tab.pinned }}</span>
      </ng-template>
      <omni-window header="Mail" badge="new" pinned [width]="200" [height]="100" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TemplateHostComponent {
  readonly windows = viewChildren(WindowComponent);
}

describe('Dock extras', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const win = (header: string) => host.windows().find((w) => w.header() === header)!;
  const tabs = () => [...element.querySelectorAll<HTMLButtonElement>('.omni-dock-tab')];
  const tab = (header: string) => tabs().find((t) => t.getAttribute('title') === header)!;
  const stable = () => fixture.whenStable();

  async function create(setup: (host: HostComponent) => void = () => undefined): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    setup(host);
    await stable();
    await new Promise((resolve) => setTimeout(resolve));
    await stable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('positions', () => {
    it.each<[DockPosition, string]>([
      ['bottom', 'horizontal'],
      ['top', 'horizontal'],
      ['left', 'vertical'],
      ['right', 'vertical'],
    ])('renders a %s dock, %s', async (position, orientation) => {
      await create((h) => h.dock.set(position));
      const dock = element.querySelector('omni-dock')!;
      expect(dock.classList).toContain(`omni-dock-${position}`);
      expect(dock.getAttribute('aria-orientation')).toBe(orientation);
    });

    it('moves between tabs with the up and down keys on a vertical dock', async () => {
      await create((h) => h.dock.set('left'));
      tab('Mail').focus();
      tab('Mail').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      await stable();
      expect(document.activeElement).toBe(tab('Notes'));
    });
  });

  describe('badges', () => {
    it('shows the badge on the tab and in its label', async () => {
      await create();
      expect(tab('Mail').querySelector('.omni-dock-badge')?.textContent?.trim()).toBe('3');
      expect(tab('Mail').getAttribute('aria-label')).toBe('Mail (3)');
      expect(tab('Notes').querySelector('.omni-dock-badge')).toBeNull();
    });

    it('follows the input and hides an empty or zero badge', async () => {
      await create();
      host.badge.set('new');
      await stable();
      expect(tab('Mail').querySelector('.omni-dock-badge')?.textContent?.trim()).toBe('new');
      host.badge.set(0);
      await stable();
      expect(tab('Mail').querySelector('.omni-dock-badge')).toBeNull();
      expect(tab('Mail').getAttribute('aria-label')).toBe('Mail');
      host.badge.set(null);
      await stable();
      expect(tab('Mail').querySelector('.omni-dock-badge')).toBeNull();
    });

    it('is listed by the desktop API', async () => {
      await create();
      const desktop = fixture.debugElement.children[0].componentInstance as DesktopComponent;
      expect(desktop.windows().map((w) => [w.header, w.badge, w.pinned])).toEqual([
        ['Mail', 3, true],
        ['Notes', null, false],
        ['Clock', null, false],
      ]);
    });
  });

  describe('pinned windows', () => {
    it('keep their tab while closed, dimmed and labelled, and open again from it', async () => {
      await create();
      win('Mail').close();
      win('Notes').close();
      await stable();
      expect(tabs().map((t) => t.getAttribute('title'))).toEqual(['Mail']);
      expect(tab('Mail').classList).toContain('omni-dock-tab-closed');
      expect(tab('Mail').getAttribute('aria-label')).toBe('Mail (3), closed');

      tab('Mail').click();
      await stable();
      expect(win('Mail').visible()).toBe(true);
      expect(tab('Mail').classList).not.toContain('omni-dock-tab-closed');
    });

    it('are not minimized by minimizeAll while closed', async () => {
      await create();
      win('Mail').close();
      await stable();
      const desktop = fixture.debugElement.children[0].componentInstance as DesktopComponent;
      desktop.minimizeAll();
      expect(win('Mail').minimized()).toBe(false);
      expect(win('Notes').minimized()).toBe(true);
    });
  });

  it('renders a custom tab template inside each tab, keeping the tab button', async () => {
    const templateFixture = TestBed.createComponent(TemplateHostComponent);
    await templateFixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await templateFixture.whenStable();
    const root = templateFixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.omni-dock-tab')!;
    expect(button.classList).toContain('omni-dock-tab-custom');
    expect(button.querySelector('.custom-tab')?.textContent?.trim()).toBe('Mail·new·true');
    expect(button.querySelector('.omni-dock-badge')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Mail (new)');

    templateFixture.componentInstance.windows()[0].close();
    await templateFixture.whenStable();
    expect(button.querySelector('.custom-tab')?.classList).toContain('closed');
  });
});
