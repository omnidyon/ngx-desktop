import { ChangeDetectionStrategy, Component, contentChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { WindowFooterDirective, WindowHeaderDirective } from './window-slots.directive';

@Component({
  selector: 'omni-slot-host',
  template: `
    <div class="header">
      <ng-content select="[omniWindowHeader]" />
    </div>
    <div class="footer"><ng-content select="[omniWindowFooter]" /></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SlotHostComponent {
  readonly header = contentChild(WindowHeaderDirective);
  readonly footer = contentChild(WindowFooterDirective);
}

@Component({
  imports: [SlotHostComponent, WindowHeaderDirective, WindowFooterDirective],
  template: `
    <omni-slot-host>
      <span omniWindowHeader>Title</span>
      <div omniWindowFooter>Actions</div>
    </omni-slot-host>
    <omni-slot-host class="empty" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('window slot directives', () => {
  it('mark projected header and footer content and project it into the slots', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.header [omniWindowHeader]');
    const footer = element.querySelector('.footer [omniWindowFooter]');
    expect(header?.classList).toContain('omni-window-header-slot');
    expect(footer?.classList).toContain('omni-window-footer-slot');
    expect(header?.textContent).toBe('Title');
  });

  it('can be detected with contentChild, and are absent when not used', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const [withSlots, empty] = fixture.debugElement
      .queryAll(By.directive(SlotHostComponent))
      .map((node) => node.componentInstance as SlotHostComponent);
    expect(withSlots.header()).toBeInstanceOf(WindowHeaderDirective);
    expect(withSlots.footer()).toBeInstanceOf(WindowFooterDirective);
    expect(empty.header()).toBeUndefined();
    expect(empty.footer()).toBeUndefined();
  });
});
