import { ChangeDetectionStrategy, Component, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { injectDesktopSession } from '../../session/desktop-session';
import { InMemorySessionStorage, provideDesktopSessionStorage } from '../../session/session-storage';
import { DesktopComponent } from '../desktop/desktop.component';
import { LAYOUT_SAVE_DELAY, WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      @for (w of session.windows(); track w.key) {
        <omni-window
          [header]="w.data.title"
          position="topleft"
          [width]="200"
          [height]="100"
          [persistKey]="w.key"
          (closed)="session.close(w.key)"
        />
      }
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly session = injectDesktopSession<{ title: string }>('test-session');
  readonly windows = viewChildren(WindowComponent);
}

/** Desktop is 800 × 600. */
describe('Windows from a desktop session', () => {
  let sessions: InMemorySessionStorage;
  let layouts: InMemoryLayoutStorage;
  let fixture: ComponentFixture<HostComponent>;

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const afterSaveDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_SAVE_DELAY + 50));
    await fixture.whenStable();
  };

  async function create(): Promise<HostComponent> {
    fixture = TestBed.createComponent(HostComponent);
    await settle();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    sessions = new InMemorySessionStorage();
    layouts = new InMemoryLayoutStorage();
    TestBed.configureTestingModule({
      providers: [provideDesktopSessionStorage(sessions), provideDesktopLayoutStorage(layouts)],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('re-creates opened windows, at their saved position, after a reload', async () => {
    const host = await create();
    const key = host.session.open({ title: 'Doc 1' });
    await settle();
    host.windows()[0].rect.set({ x: 120, y: 80, width: 250, height: 150 });
    await afterSaveDelay();
    fixture.destroy();

    const reloaded = await create();
    await settle();
    expect(reloaded.session.windows().map((w) => w.key)).toEqual([key]);
    expect(reloaded.windows()[0].rect()).toEqual({ x: 120, y: 80, width: 250, height: 150 });
  });

  it('forgets a closed window: it is gone after a reload and its layout is not written back', async () => {
    const host = await create();
    const key = host.session.open({ title: 'Doc 1' });
    await settle();
    await afterSaveDelay();
    expect(await layouts.load(key)).not.toBeNull();

    // Move it, then close it right away: the move is still waiting to be saved when it is destroyed.
    host.windows()[0].rect.set({ x: 300, y: 300, width: 200, height: 100 });
    await fixture.whenStable();
    host.windows()[0].close();
    await settle();
    await afterSaveDelay();

    expect(host.windows()).toHaveLength(0);
    expect(await layouts.load(key)).toBeNull();
    fixture.destroy();
    const reloaded = await create();
    expect(reloaded.windows()).toHaveLength(0);
  });

  it('forgetLayout() stops a living window from saving its layout again', async () => {
    const host = await create();
    const key = host.session.open({ title: 'Doc 1' });
    await settle();
    await afterSaveDelay();
    const window = host.windows()[0];
    await window.forgetLayout();
    window.rect.set({ x: 10, y: 10, width: 200, height: 100 });
    await afterSaveDelay();
    expect(await layouts.load(key)).toBeNull();
  });
});
