/**
 * @license
 * Copyright Slavko Mihajlovic All Rights Reserved.
 *
 * Use of this source code is governed by an ISC-style license that can be
 * found at https://www.isc.org/licenses/
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { DESKTOP_CONFIG } from '../../config/desktop-config';
import { DESKTOP_LABELS } from '../../config/desktop-labels';
import { zoneRect } from '../../geometry/snap-zones';
import { LayoutZone } from '../../models/types';
import { DesktopService, LayoutPicker } from '../../services/desktop.service';

/** @internal The layouts offered, each a list of the zones it is made of. */
export const SNAP_LAYOUTS: readonly (readonly LayoutZone[])[] = [
  ['left', 'right'],
  ['lefttwothirds', 'rightthird'],
  ['leftthird', 'righttwothirds'],
  ['leftthird', 'centerthird', 'rightthird'],
  ['topleft', 'topright', 'bottomleft', 'bottomright'],
  ['lefttwothirds', 'toprightthird', 'bottomrightthird'],
];

/** @internal Size of the flyout in px (3 × 2 layouts of 64 × 40, 8px apart, 8px padding). */
export const LAYOUT_PICKER_SIZE = { width: 224, height: 112 };
/** Space kept between the flyout, its button and the desktop edges. */
const MARGIN = 4;

/** Where each zone sits inside a layout picture, in percent. */
const UNIT = { x: 0, y: 0, width: 100, height: 100 };

/**
 * @internal
 * @description
 * The snap layouts flyout of a window's maximize button, rendered by the desktop: a picture per layout,
 * each zone a button that snaps the window there. Closes on a choice, Escape, a pointer press outside,
 * or when the pointer leaves it (the window's maximize button keeps it open).
 */
@Component({
  selector: 'omni-snap-layouts',
  templateUrl: './snap-layouts.component.html',
  styleUrl: './snap-layouts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    '[attr.aria-label]': 'labels().snapLayouts',
    '[style.left.px]': 'position().x',
    '[style.top.px]': 'position().y',
    '[style.width.px]': 'size.width',
    '[style.height.px]': 'size.height',
    '[style.z-index]': 'zIndex',
    '(mouseenter)': 'desktop.keepLayoutPicker()',
    '(mouseleave)': 'desktop.closeLayoutPickerSoon()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class SnapLayoutsComponent {
  protected readonly desktop = inject(DesktopService);
  protected readonly labels = inject(DESKTOP_LABELS);
  protected readonly zIndex = inject(DESKTOP_CONFIG).zIndex.dock + 1;
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;

  readonly picker = input.required<LayoutPicker>();

  protected readonly layouts = SNAP_LAYOUTS;
  protected readonly size = LAYOUT_PICKER_SIZE;

  /** Below the maximize button, right-aligned to it; above it when there is no room below; inside the desktop. */
  protected readonly position = computed(() => {
    const { anchor } = this.picker();
    this.desktop.size();
    const bounds = this.desktop.bounds();
    const { width, height } = this.size;
    const maxX = bounds.x + bounds.width - width - MARGIN;
    const maxY = bounds.y + bounds.height - height - MARGIN;
    const x = Math.max(Math.min(anchor.x + anchor.width - width, maxX), bounds.x + MARGIN);
    const below = anchor.y + anchor.height + MARGIN;
    const y = below <= maxY ? below : Math.max(Math.min(anchor.y - height - MARGIN, maxY), bounds.y + MARGIN);
    return { x, y };
  });

  constructor() {
    const document = inject(DOCUMENT);
    // A press anywhere else closes the flyout (the maximize button closes it itself).
    const onPointerDown = (event: PointerEvent): void => {
      if (!this.element.contains(event.target as Node)) this.close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onPointerDown, true));

    // Opened from the keyboard: start on the first zone.
    afterNextRender(() => {
      if (this.picker().returnFocus) this.element.querySelector<HTMLElement>('.omni-snap-zone')?.focus();
    });
  }

  /** Where a zone sits inside its layout picture, in percent. */
  protected zoneStyle(zone: LayoutZone): { left: number; top: number; width: number; height: number } {
    const rect = zoneRect(zone, UNIT);
    return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  }

  protected choose(zone: LayoutZone): void {
    const { window } = this.picker();
    this.close();
    window.snapTo(zone);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  private close(): void {
    const { returnFocus } = this.picker();
    this.desktop.closeLayoutPicker();
    returnFocus?.focus();
  }
}
