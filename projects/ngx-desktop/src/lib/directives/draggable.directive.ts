/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  booleanAttribute,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
} from '@angular/core';

/**
 * @publicApi
 * @description
 * Pointer position data emitted while dragging. `dx`/`dy` are relative to where the drag started.
 */
export interface DragPointerEvent {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  dx: number;
  dy: number;
}

/** Elements that keep their own pointer behaviour and never start a drag. */
const NO_DRAG_SELECTOR = 'button, a, input, textarea, select, [contenteditable], [data-omni-no-drag]';

/**
 * @publicApi
 * @description
 * Turns the host element into a drag handle using Pointer Events, so mouse, pen and touch all work.
 * It only reports pointer movement; what moves (a window, an edge) is decided by the consumer.
 *
 * The pointer is followed outside Angular's zone, and `dragMove` is emitted at most once per animation
 * frame (with the latest position), so fast mice do not run change detection for every event. A move
 * still waiting for its frame is emitted before `dragEnd`.
 *
 * @usageNotes
 * <div omniDraggable (dragMove)="onMove($event)" (dragEnd)="onEnd($event)"></div>
 * <div [omniDraggable]="false"></div>   -- disabled
 */
@Directive({
  selector: '[omniDraggable]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '[style.touch-action]': 'omniDraggable() ? "none" : null',
    '[class.omni-dragging]': 'active()',
  },
})
export class DraggableDirective {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  /** Whether dragging is enabled. */
  readonly omniDraggable = input(true, { transform: booleanAttribute });

  readonly dragStart = output<DragPointerEvent>();
  readonly dragMove = output<DragPointerEvent>();
  readonly dragEnd = output<DragPointerEvent>();

  protected readonly active = signal(false);
  private cleanup: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup?.());
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.omniDraggable() || this.active() || event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.(NO_DRAG_SELECTOR)) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const toDrag = (e: PointerEvent): DragPointerEvent => ({
      pointerId,
      startX,
      startY,
      clientX: e.clientX,
      clientY: e.clientY,
      dx: e.clientX - startX,
      dy: e.clientY - startY,
    });

    // Not every environment implements pointer capture (e.g. jsdom); document listeners work either way.
    this.element.setPointerCapture?.(pointerId);
    this.active.set(true);

    const view = this.document.defaultView;
    /** The latest move that has not been emitted yet, and the frame that will emit it. */
    let pending: DragPointerEvent | null = null;
    let frame: number | null = null;
    const flush = (): void => {
      frame = null;
      const move = pending;
      pending = null;
      if (move) this.zone.run(() => this.dragMove.emit(move));
    };

    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      pending = toDrag(e);
      if (frame !== null) return;
      if (view?.requestAnimationFrame) {
        frame = view.requestAnimationFrame(flush);
      } else {
        flush();
      }
    };
    const onEnd = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      // The last position counts, even if its frame has not come yet.
      if (frame !== null) view?.cancelAnimationFrame(frame);
      flush();
      this.zone.run(() => {
        this.cleanup?.();
        this.dragEnd.emit(toDrag(e));
      });
    };

    this.zone.runOutsideAngular(() => {
      this.document.addEventListener('pointermove', onMove);
      this.document.addEventListener('pointerup', onEnd);
      this.document.addEventListener('pointercancel', onEnd);
    });
    this.cleanup = () => {
      if (frame !== null) view?.cancelAnimationFrame(frame);
      frame = null;
      pending = null;
      this.document.removeEventListener('pointermove', onMove);
      this.document.removeEventListener('pointerup', onEnd);
      this.document.removeEventListener('pointercancel', onEnd);
      if (this.element.hasPointerCapture?.(pointerId)) this.element.releasePointerCapture(pointerId);
      this.active.set(false);
      this.cleanup = null;
    };

    this.dragStart.emit(toDrag(event));
  }
}
