import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  DESKTOP_LAYOUT_STORAGE,
  DesktopComponent,
  DesktopTheme,
  DialogComponent,
  DockPosition,
  Rect,
  WindowComponent,
  WindowFooterDirective,
  WindowHeaderDirective,
} from '@omnidyon/ngx-desktop';

/** A temporary window added with the "Add window" button. */
interface DemoWindow {
  id: number;
  title: string;
  icon?: string;
  x: number;
  y: number;
}

/** Icons the added windows cycle through; `undefined` gives a text-only dock tab. */
const DEMO_ICONS: (string | undefined)[] = [
  'icons/angular.svg',
  'icons/nest.svg',
  'icons/node.svg',
  'icons/react.svg',
  undefined,
];

/** Added windows cascade by this many px and start over after this many steps. */
const CASCADE_STEP = 32;
const CASCADE_LENGTH = 10;

@Component({
  selector: 'app-root',
  imports: [DesktopComponent, WindowComponent, DialogComponent, WindowHeaderDirective, WindowFooterDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly layoutStorage = inject(DESKTOP_LAYOUT_STORAGE);

  protected readonly themes: DesktopTheme[] = [
    'default',
    'aqua',
    'discord',
    'light',
    'neo-san-francisco',
    'neo-tokyo',
    'twitch',
  ];
  protected readonly docks: DockPosition[] = ['bottom', 'top', 'none'];

  protected readonly theme = signal<DesktopTheme>('default');
  protected readonly dock = signal<DockPosition>('bottom');
  protected readonly dialogOpen = signal(false);
  protected readonly modal = signal(true);
  protected readonly standaloneOpen = signal(false);
  protected readonly notesOpen = signal(true);
  protected readonly snapToZones = signal(true);
  protected readonly snapToWindows = signal(true);
  protected readonly snapPadding = signal(8);
  protected readonly allowOverlap = signal(true);
  protected readonly log = signal<string[]>([]);
  protected readonly notesRect = signal<Rect | null>(null);
  protected readonly addedWindows = signal<DemoWindow[]>([]);

  /** Numbers the added windows; the three built-in windows come first. */
  private nextWindow = 4;

  protected setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as DesktopTheme);
  }

  protected setSnapPadding(event: Event): void {
    this.snapPadding.set(Math.max(0, Number((event.target as HTMLInputElement).value) || 0));
  }

  protected setDock(event: Event): void {
    this.dock.set((event.target as HTMLSelectElement).value as DockPosition);
  }

  protected addWindow(): void {
    const number = this.nextWindow++;
    const step = (number - 4) % CASCADE_LENGTH;
    const window: DemoWindow = {
      id: number,
      title: `Window ${number}`,
      icon: DEMO_ICONS[(number - 4) % DEMO_ICONS.length],
      x: 40 + step * CASCADE_STEP,
      y: 40 + step * CASCADE_STEP,
    };
    this.addedWindows.update((windows) => [...windows, window]);
    this.record(`${window.title} added`);
  }

  protected removeWindow(window: DemoWindow): void {
    this.addedWindows.update((windows) => windows.filter((w) => w.id !== window.id));
    this.record(`${window.title} closed`);
  }

  protected removeAddedWindows(): void {
    this.addedWindows.set([]);
    this.record('Added windows removed');
  }

  /** Forgets every saved window layout and reloads, so the windows start from their initial placement. */
  protected async resetLayout(): Promise<void> {
    await this.layoutStorage.clear();
    location.reload();
  }

  protected record(entry: string): void {
    this.log.update((log) => [entry, ...log].slice(0, 6));
  }
}
