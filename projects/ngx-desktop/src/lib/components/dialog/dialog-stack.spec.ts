import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogStack } from './dialog-stack';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  template: `
    <omni-dialog header="First" [(visible)]="first" />
    <omni-dialog header="Second" [(visible)]="second" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly first = signal(false);
  readonly second = signal(false);
}

describe('DialogStack', () => {
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  it('lets Escape close only the topmost dialog, whatever order they were created in', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    // The second dialog (created last) opens first, so the first one ends up on top.
    host.second.set(true);
    await fixture.whenStable();
    host.first.set(true);
    await fixture.whenStable();

    escape();
    await fixture.whenStable();
    expect(host.first()).toBe(false);
    expect(host.second()).toBe(true);

    escape();
    await fixture.whenStable();
    expect(host.second()).toBe(false);
  });

  it('forgets a dialog that is destroyed while open', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.first.set(true);
    await fixture.whenStable();
    const stack = TestBed.inject(DialogStack);
    fixture.destroy();
    const other = {};
    stack.push(other);
    expect(stack.isTop(other)).toBe(true);
    stack.remove(other);
  });

  it('claims each event once, for the top dialog only', () => {
    const stack = TestBed.inject(DialogStack);
    const a = {};
    const b = {};
    stack.push(a);
    stack.push(b);
    const event = new KeyboardEvent('keydown');
    expect(stack.claim(event, a)).toBe(false);
    expect(stack.claim(event, b)).toBe(true);
    expect(stack.claim(event, b)).toBe(false);
    stack.remove(b);
    stack.remove(a);
  });
});
