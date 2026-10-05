import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  DesktopComponent,
  DesktopTheme,
  DialogComponent,
  DockPosition,
  WindowComponent,
  WindowFooterDirective,
  WindowHeaderDirective,
} from '@omnidyon/ngx-desktop';

@Component({
  selector: 'app-root',
  imports: [DesktopComponent, WindowComponent, DialogComponent, WindowHeaderDirective, WindowFooterDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
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
  protected readonly log = signal<string[]>([]);

  protected setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as DesktopTheme);
  }

  protected setSnapPadding(event: Event): void {
    this.snapPadding.set(Math.max(0, Number((event.target as HTMLInputElement).value) || 0));
  }

  protected setDock(event: Event): void {
    this.dock.set((event.target as HTMLSelectElement).value as DockPosition);
  }

  protected record(entry: string): void {
    this.log.update((log) => [entry, ...log].slice(0, 6));
  }
}
