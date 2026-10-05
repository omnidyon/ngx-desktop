import { ChangeDetectionStrategy, Component, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop dock="none">
      <omni-window header="A" [width]="200" [height]="100"><button class="a">A</button></omni-window>
      <omni-window header="B" [width]="200" [height]="100"><button class="b">B</button></omni-window>
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DesktopHostComponent {}

@Component({
  imports: [WindowComponent],
  template: `
    <omni-window header="A" [width]="200" [height]="100"><button class="a">A</button></omni-window>
    <omni-window header="B" [width]="200" [height]="100"><button class="b">B</button></omni-window>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StandaloneHostComponent {
  readonly windows = viewChildren(WindowComponent);
}

describe('Window keyboard focus', () => {
  const zOf = (fixture: ComponentFixture<unknown>, header: string) =>
    Number((fixture.nativeElement.querySelector(`omni-window[aria-label="${header}"]`) as HTMLElement).style.zIndex);

  async function focusButton(fixture: ComponentFixture<unknown>, selector: string): Promise<void> {
    (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).focus();
    await fixture.whenStable();
  }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => vi.restoreAllMocks());

  it('brings a window inside a desktop to the front when focus moves into it', async () => {
    const fixture = TestBed.createComponent(DesktopHostComponent);
    await fixture.whenStable();
    expect(zOf(fixture, 'B')).toBeGreaterThan(zOf(fixture, 'A'));

    await focusButton(fixture, 'button.a');
    expect(zOf(fixture, 'A')).toBeGreaterThan(zOf(fixture, 'B'));

    await focusButton(fixture, 'button.b');
    expect(zOf(fixture, 'B')).toBeGreaterThan(zOf(fixture, 'A'));
  });

  it('brings a standalone window to the front, even when both start at the same z-index', async () => {
    const fixture = TestBed.createComponent(StandaloneHostComponent);
    await fixture.whenStable();

    await focusButton(fixture, 'button.a');
    expect(zOf(fixture, 'A')).toBeGreaterThan(zOf(fixture, 'B'));

    await focusButton(fixture, 'button.b');
    expect(zOf(fixture, 'B')).toBeGreaterThan(zOf(fixture, 'A'));
  });

  it('does not keep raising a window that is already in front', async () => {
    const fixture = TestBed.createComponent(StandaloneHostComponent);
    await fixture.whenStable();
    await focusButton(fixture, 'button.a');
    const z = zOf(fixture, 'A');

    (fixture.nativeElement.querySelector('button.a') as HTMLButtonElement).blur();
    await focusButton(fixture, 'button.a');
    fixture.componentInstance.windows()[0].focus();
    await fixture.whenStable();
    expect(zOf(fixture, 'A')).toBe(z);
  });
});
