import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DESKTOP_DEV_MODE } from '../../config/dev-mode';
import { WindowComponent } from '../window/window.component';
import { DesktopComponent } from './desktop.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      <omni-window header="W" />
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

/** A desktop that is on the page but measures 0 × 0 (usually a parent without a height). */
describe('DesktopComponent size warning', () => {
  let warnings: string[] = [];

  const render = async (rendered: boolean, devMode = true) => {
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_DEV_MODE, useValue: devMode }] });
    // jsdom has no layout: every element measures 0 × 0. offsetParent tells "on the page" from display: none.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(rendered ? document.body : null);
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture;
  };
  const sizeWarnings = () => warnings.filter((message) => message.includes('no width or height'));

  beforeEach(() => {
    warnings = [];
    vi.spyOn(console, 'warn').mockImplementation((message?: unknown) => void warnings.push(String(message)));
  });

  afterEach(() => vi.restoreAllMocks());

  it('warns once when a rendered desktop has no size', async () => {
    const fixture = await render(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(sizeWarnings()).toHaveLength(1);
  });

  it('does not warn for a desktop hidden on purpose (display: none)', async () => {
    await render(false);
    expect(sizeWarnings()).toHaveLength(0);
  });

  it('does not warn in production builds', async () => {
    await render(true, false);
    expect(sizeWarnings()).toHaveLength(0);
  });

  it('does not warn when the desktop has a size', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    await render(true);
    expect(sizeWarnings()).toHaveLength(0);
  });
});
