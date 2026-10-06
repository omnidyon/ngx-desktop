import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

/** Ticks every second while it exists; shows when it was created. Used as lazy window content in the demo. */
@Component({
  selector: 'app-live-clock',
  templateUrl: './live-clock.component.html',
  styleUrl: './live-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveClockComponent {
  protected readonly createdAt = new Date().toLocaleTimeString();
  protected readonly now = signal(new Date().toLocaleTimeString());

  constructor() {
    const timer = setInterval(() => this.now.set(new Date().toLocaleTimeString()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
