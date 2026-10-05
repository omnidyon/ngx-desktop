import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InMemoryLayoutStorage, provideDesktopLayoutStorage } from '@omnidyon/ngx-desktop';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let compiled: HTMLElement;

  const button = (text: string): HTMLButtonElement =>
    Array.from(compiled.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  const desktopWindows = () => compiled.querySelectorAll('omni-desktop omni-window');
  const dockTabs = () => compiled.querySelectorAll('.omni-dock-tab');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideDesktopLayoutStorage(new InMemoryLayoutStorage())],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    compiled = fixture.nativeElement;
    await fixture.whenStable();
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
    await fixture.whenStable();
    expect(desktopWindows()).toHaveLength(5);
    expect(dockTabs()).toHaveLength(5);
    const labels = Array.from(desktopWindows()).map((w) => w.getAttribute('aria-label'));
    expect(labels).toContain('Window 4');
    expect(labels).toContain('Window 5');
  });

  it('removes an added window when it is closed', async () => {
    button('Add window').click();
    await fixture.whenStable();
    const added = Array.from(desktopWindows()).find((w) => w.getAttribute('aria-label') === 'Window 4')!;
    added.querySelector<HTMLButtonElement>('.omni-window-button[aria-label="Close"]')!.click();
    await fixture.whenStable();
    expect(desktopWindows()).toHaveLength(3);
  });

  it('removes all added windows, and only enables that when there are some', async () => {
    expect(button('Remove added').disabled).toBe(true);
    button('Add window').click();
    button('Add window').click();
    await fixture.whenStable();
    expect(button('Remove added').disabled).toBe(false);
    button('Remove added').click();
    await fixture.whenStable();
    expect(desktopWindows()).toHaveLength(3);
    expect(button('Remove added').disabled).toBe(true);
  });
});
