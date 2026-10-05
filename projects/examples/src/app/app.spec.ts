import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a desktop with three windows', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('omni-desktop omni-window')).toHaveLength(3);
  });

  it('opens the dialog from the toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.omni-dialog')).toBeNull();
    const open = Array.from(compiled.querySelectorAll('button')).find((b) => b.textContent?.includes('Open dialog'));
    open!.click();
    await fixture.whenStable();
    expect(compiled.querySelector('.omni-dialog')).not.toBeNull();
  });
});
