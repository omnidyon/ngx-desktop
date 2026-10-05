import { ChangeDetectionStrategy, Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InMemoryLayoutStorage } from '../../persistence/layout-storage';
import { provideDesktopLayoutStorage } from '../../persistence/layout-storage.provider';
import { SnapZone } from '../../models/types';
import { DesktopComponent } from '../desktop/desktop.component';
import { WindowComponent } from './window.component';

@Component({
  imports: [DesktopComponent, WindowComponent],
  template: `
    <omni-desktop>
      <omni-window class="window" header="Normal window" position="bottomright" [width]="200" [height]="100" />
      <omni-window
        class="widget"
        header="Sales"
        widget
        position="topleft"
        [width]="200"
        [height]="100"
        [draggable]="draggable()"
        [closable]="closable()"
        [(visible)]="visible"
        (closed)="closedCount = closedCount + 1"
        (snapped)="snaps.push($event)"
      >
        <p class="stat">42</p>
      </omni-window>
    </omni-desktop>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly windows = viewChildren(WindowComponent);
  readonly draggable = signal(true);
  readonly closable = signal(true);
  readonly visible = signal(true);
  closedCount = 0;
  snaps: (SnapZone | null)[] = [];
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 })
  );
}

/** Desktop is 800 × 600; the widget starts at (0, 0) 200 × 100. */
describe('Widget mode', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const widget = () => host.windows()[1];
  const widgetElement = () => element.querySelector('omni-window.widget') as HTMLElement;
  const grip = () => widgetElement().querySelector('.omni-widget-grip') as HTMLElement;
  const closeButton = () => widgetElement().querySelector<HTMLButtonElement>('.omni-widget-close');
  const stable = () => fixture.whenStable();

  async function drag(target: Element, dx: number, dy: number): Promise<void> {
    pointer(target, 'pointerdown', 100, 5);
    pointer(document, 'pointermove', 100 + dx, 5 + dy);
    await stable();
    pointer(document, 'pointerup', 100 + dx, 5 + dy);
    await stable();
  }

  beforeEach(async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    TestBed.configureTestingModule({ providers: [provideDesktopLayoutStorage(new InMemoryLayoutStorage())] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await stable();
    await new Promise((resolve) => setTimeout(resolve));
    await stable();
  });

  afterEach(() => vi.restoreAllMocks());

  it('has no title bar, only its content, a grip and a close button', () => {
    expect(widgetElement().querySelector('.omni-window-header')).toBeNull();
    expect(widgetElement().querySelector('.stat')?.textContent).toBe('42');
    expect(grip()).not.toBeNull();
    expect(closeButton()).not.toBeNull();
    expect(widgetElement().classList).toContain('omni-window-widget');
  });

  it('is a labelled region instead of a dialog', () => {
    expect(widgetElement().getAttribute('role')).toBe('region');
    expect(widgetElement().getAttribute('aria-label')).toBe('Sales');
    expect(element.querySelector('omni-window.window')?.getAttribute('role')).toBe('dialog');
  });

  it('moves when its grip is dragged', async () => {
    await drag(grip(), 150, 120);
    expect(widget().rect()).toMatchObject({ x: 150, y: 120, width: 200, height: 100 });
  });

  it('does not move when it is not draggable', async () => {
    host.draggable.set(false);
    await stable();
    await drag(grip(), 150, 120);
    expect(widget().rect()).toMatchObject({ x: 0, y: 0 });
  });

  it('does not move when its content is dragged', async () => {
    await drag(widgetElement().querySelector('.stat')!, 150, 120);
    expect(widget().rect()).toMatchObject({ x: 0, y: 0 });
  });

  it('keeps all eight resize handles', async () => {
    expect(widgetElement().querySelectorAll('.omni-resize-handle')).toHaveLength(8);
    await drag(widgetElement().querySelector('.omni-resize-se')!, 50, 40);
    expect(widget().rect()).toEqual({ x: 0, y: 0, width: 250, height: 140 });
  });

  it('snaps into a zone when dragged by its grip', async () => {
    pointer(grip(), 'pointerdown', 100, 5);
    pointer(document, 'pointermove', 3, 300);
    await stable();
    pointer(document, 'pointerup', 3, 300);
    await stable();
    expect(widget().rect()).toEqual({ x: 0, y: 0, width: 400, height: 600 });
    expect(host.snaps).toEqual(['left']);
  });

  it('closes with its close button', async () => {
    closeButton()!.click();
    await stable();
    expect(host.visible()).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('has no close button when not closable', async () => {
    host.closable.set(false);
    await stable();
    expect(closeButton()).toBeNull();
  });

  it('gets no dock tab, while normal windows keep theirs', () => {
    const tabs = Array.from(element.querySelectorAll('.omni-dock-tab')).map((tab) => tab.getAttribute('aria-label'));
    expect(tabs).toEqual(['Normal window']);
  });

  it('does not maximize on double-click', async () => {
    widgetElement()
      .querySelector('.stat')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    grip().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await stable();
    expect(widget().maximized()).toBe(false);
  });
});
