import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  InMemoryLayoutStorage,
  InMemorySessionStorage,
  provideDesktopLayoutStorage,
  provideDesktopSessionStorage,
} from '@omnidyon/ngx-desktop';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let compiled: HTMLElement;

  const button = (text: string): HTMLButtonElement =>
    Array.from(compiled.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  const desktopWindows = () => compiled.querySelectorAll('omni-desktop omni-window');
  const windowLabels = () => Array.from(desktopWindows()).map((w) => w.getAttribute('aria-label'));
  const dockTabs = () => compiled.querySelectorAll('.omni-dock-tab');
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  /** Creates the app; calling it again with the same storages behaves like a page reload. */
  async function render(): Promise<void> {
    fixture = TestBed.createComponent(App);
    compiled = fixture.nativeElement;
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideDesktopLayoutStorage(new InMemoryLayoutStorage()),
        provideDesktopSessionStorage(new InMemorySessionStorage()),
      ],
    }).compileComponents();
    await render();
  });

  it('renders a desktop with three windows', () => {
    expect(desktopWindows()).toHaveLength(3);
    expect(dockTabs()).toHaveLength(3);
  });

  it('opens the dialog from the toolbar', async () => {
    expect(compiled.querySelector('.omni-dialog')).toBeNull();
    button('Open dialog').click();
    await fixture.whenStable();
    expect(compiled.querySelector('.omni-dialog')).not.toBeNull();
  });

  it('adds windows with unique titles and dock tabs', async () => {
    button('Add window').click();
    button('Add window').click();
    await settle();
    expect(desktopWindows()).toHaveLength(5);
    expect(dockTabs()).toHaveLength(5);
    expect(windowLabels()).toEqual(expect.arrayContaining(['Window 4', 'Window 5']));
  });

  it('keeps added windows across a reload', async () => {
    button('Add window').click();
    button('Add window').click();
    await settle();
    fixture.destroy();

    await render();
    expect(windowLabels()).toEqual(expect.arrayContaining(['Window 4', 'Window 5']));
    // numbering continues after the restored windows
    button('Add window').click();
    await settle();
    expect(windowLabels()).toContain('Window 6');
  });

  it('forgets an added window when it is closed', async () => {
    button('Add window').click();
    await settle();
    const added = Array.from(desktopWindows()).find((w) => w.getAttribute('aria-label') === 'Window 4')!;
    added.querySelector<HTMLButtonElement>('.omni-window-button[aria-label="Close"]')!.click();
    await settle();
    expect(desktopWindows()).toHaveLength(3);

    fixture.destroy();
    await render();
    expect(windowLabels()).not.toContain('Window 4');
  });

  it('adds widgets without a title bar or dock tab, and keeps them across a reload', async () => {
    button('Add widget').click();
    await settle();
    const widget = Array.from(desktopWindows()).find((w) => w.getAttribute('aria-label') === 'Widget 4')!;
    expect(widget.classList).toContain('omni-window-widget');
    expect(widget.querySelector('.omni-window-header')).toBeNull();
    expect(dockTabs()).toHaveLength(3);

    fixture.destroy();
    await render();
    expect(windowLabels()).toContain('Widget 4');
  });

  it('removes all added windows, and only enables that when there are some', async () => {
    expect(button('Remove added').disabled).toBe(true);
    button('Add window').click();
    button('Add window').click();
    await settle();
    expect(button('Remove added').disabled).toBe(false);
    button('Remove added').click();
    await settle();
    expect(desktopWindows()).toHaveLength(3);
    expect(button('Remove added').disabled).toBe(true);

    fixture.destroy();
    await render();
    expect(desktopWindows()).toHaveLength(3);
  });
});
