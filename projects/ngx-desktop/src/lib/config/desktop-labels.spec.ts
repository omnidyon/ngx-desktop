import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DesktopComponent } from '../components/desktop/desktop.component';
import { DialogComponent } from '../components/dialog/dialog.component';
import { WindowComponent } from '../components/window/window.component';
import { provideDesktopConfig } from './desktop-config';
import { DEFAULT_DESKTOP_LABELS, DESKTOP_LABELS, DesktopLabels, formatLabel } from './desktop-labels';

@Component({
  imports: [DesktopComponent, WindowComponent, DialogComponent],
  template: `
    <omni-desktop>
      <omni-window [width]="200" [height]="100" />
    </omni-desktop>
    <omni-dialog header="D" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

const german: Partial<DesktopLabels> = {
  close: 'Schließen',
  minimize: 'Minimieren',
  maximize: 'Maximieren',
  fullScreen: 'Vollbild',
  dock: 'Fenster',
  untitledWindow: 'Unbenannt',
};

describe('desktop labels', () => {
  const labelsIn = (root: HTMLElement) => ({
    window: [...root.querySelectorAll('omni-window .omni-window-button')].map((b) => b.getAttribute('aria-label')),
    dialog: root.querySelector('omni-dialog .omni-window-button')?.getAttribute('aria-label'),
    dock: root.querySelector('omni-dock')?.getAttribute('aria-label'),
    tab: root.querySelector('.omni-dock-tab')?.getAttribute('aria-label'),
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('defaults to English', async () => {
    expect(TestBed.inject(DESKTOP_LABELS)()).toEqual(DEFAULT_DESKTOP_LABELS);
    expect(labelsIn(await render())).toEqual({
      window: ['Minimize', 'Maximize', 'Full screen', 'Close'],
      dialog: 'Close',
      dock: 'Windows',
      tab: 'Window',
    });
  });

  it('uses the given labels, falling back to English for missing ones', async () => {
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ labels: german })] });
    expect(TestBed.inject(DESKTOP_LABELS)()).toEqual({ ...DEFAULT_DESKTOP_LABELS, ...german });
    expect(labelsIn(await render())).toEqual({
      window: ['Minimieren', 'Maximieren', 'Vollbild', 'Schließen'],
      dialog: 'Schließen',
      dock: 'Fenster',
      tab: 'Unbenannt',
    });
  });

  it('follows a signal, for switching language at runtime', async () => {
    const labels = signal<Partial<DesktopLabels>>({});
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ labels })] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(labelsIn(fixture.nativeElement).dialog).toBe('Close');

    labels.set(german);
    await fixture.whenStable();
    expect(labelsIn(fixture.nativeElement)).toMatchObject({ dialog: 'Schließen', dock: 'Fenster', tab: 'Unbenannt' });
  });

  it('leaves the labels alone when only other settings are given', () => {
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ motion: 'none' })] });
    expect(TestBed.inject(DESKTOP_LABELS)()).toEqual(DEFAULT_DESKTOP_LABELS);
  });
});

describe('formatLabel', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(formatLabel('{name} moved to {x}, {y} {z}', { name: 'Notes', x: 10, y: 0 })).toBe(
      'Notes moved to 10, 0 {z}'
    );
  });
});

describe('zone labels', () => {
  it('can be translated one by one, the others staying English', () => {
    TestBed.configureTestingModule({
      providers: [provideDesktopConfig({ labels: { zones: { left: 'Linke Hälfte' } } })],
    });
    const labels = TestBed.inject(DESKTOP_LABELS)();
    expect(labels.zones.left).toBe('Linke Hälfte');
    expect(labels.zones.right).toBe(DEFAULT_DESKTOP_LABELS.zones.right);
    expect(labels.close).toBe('Close');
  });
});
