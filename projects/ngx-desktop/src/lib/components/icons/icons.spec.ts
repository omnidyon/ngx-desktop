import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloseIconComponent } from './close-icon/close-icon.component';
import { FullScreenIconComponent } from './full-screen-icon/full-screen-icon.component';
import { MaximizeIconComponent } from './maximize-icon/maximize-icon.component';
import { MinimizeIconComponent } from './minimize-icon/minimize-icon.component';
import { MoveIconComponent } from './move-icon/move-icon.component';
import { ResizeIconComponent } from './resize-icon/resize-icon.component';

describe('icons', () => {
  const icons: Type<unknown>[] = [
    CloseIconComponent,
    FullScreenIconComponent,
    MaximizeIconComponent,
    MinimizeIconComponent,
    MoveIconComponent,
    ResizeIconComponent,
  ];

  for (const icon of icons) {
    it(`${icon.name} renders a decorative svg`, async () => {
      const fixture = TestBed.createComponent(icon);
      await fixture.whenStable();
      const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
    });
  }

  for (const icon of [MinimizeIconComponent, MaximizeIconComponent]) {
    it(`${icon.name} switches to a different glyph when restore is set`, async () => {
      const fixture = TestBed.createComponent<MinimizeIconComponent | MaximizeIconComponent>(icon);
      await fixture.whenStable();
      const before = (fixture.nativeElement as HTMLElement).innerHTML;
      fixture.componentRef.setInput('restore', true);
      await fixture.whenStable();
      expect((fixture.nativeElement as HTMLElement).innerHTML).not.toBe(before);
    });
  }
});
