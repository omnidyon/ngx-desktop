import { expect, Locator, Page, test } from '@playwright/test';

/**
 * The examples app driven like a user: real mouse and keyboard input, positions measured on screen.
 * Every test starts with a fresh browser context, so nothing saved by another test (IndexedDB) leaks in.
 */

const windowNamed = (page: Page, name: string) => page.locator(`omni-window[aria-label="${name}"]`);
const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const windowButton = (page: Page, name: string, label: string) =>
  windowNamed(page, name).locator(`.omni-window-button[aria-label="${label}"]`);
const dockTab = (page: Page, title: string) => page.locator(`.omni-dock-tab[title="${title}"]`);
const isAway = (locator: Locator) => locator.evaluate((el) => el.classList.contains('omni-window-away'));

/** Waits until no CSS animation or transition is running (windows open, move and minimize with motion). */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
}

/** On-screen box of an element, relative to the desktop, once animations have finished. */
async function box(page: Page, locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  await settle(page);
  const desktop = (await page.locator('omni-desktop').boundingBox())!;
  const rect = (await locator.boundingBox())!;
  return {
    x: Math.round(rect.x - desktop.x),
    y: Math.round(rect.y - desktop.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/** Drags with the mouse in small steps, like a hand would. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const rect = (await locator.boundingBox())!;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(windowNamed(page, 'Angular')).toBeVisible();
  await settle(page);
});

test('renders the demo windows and a dock tab for each', async ({ page }) => {
  for (const name of ['Angular', 'Nest', 'Notes']) {
    await expect(windowNamed(page, name)).toBeVisible();
    await expect(dockTab(page, name)).toBeVisible();
  }
});

test('adds windows and widgets; widgets get no dock tab', async ({ page }) => {
  await button(page, 'Add window').click();
  await button(page, 'Add widget').click();
  await expect(page.locator('omni-window')).toHaveCount(5);
  await expect(page.locator('omni-window.omni-window-widget')).toHaveCount(1);
  await expect(page.locator('.omni-dock-tab')).toHaveCount(4);
});

test('drags a window by its title bar and snaps it to the left half at the edge', async ({ page }) => {
  // Angular has no maximum size (Nest has one, so it could not fill the half)
  const header = windowNamed(page, 'Angular').locator('.omni-window-header');
  const before = await box(page, windowNamed(page, 'Angular'));
  const start = await center(header);
  await drag(page, start, { x: start.x + 200, y: start.y + 100 });
  const moved = await box(page, windowNamed(page, 'Angular'));
  expect(moved.x - before.x).toBe(200);
  expect(moved.y - before.y).toBe(100);

  const desktop = (await page.locator('omni-desktop').boundingBox())!;
  const now = await center(header);
  await drag(page, now, { x: desktop.x + 2, y: desktop.y + desktop.height / 2 });
  const snapped = await box(page, windowNamed(page, 'Angular'));
  expect(snapped.x).toBeLessThanOrEqual(10);
  expect(snapped.width).toBeGreaterThan(desktop.width / 2 - 30);
});

test('resizes a window from its corner', async ({ page }) => {
  const before = await box(page, windowNamed(page, 'Nest'));
  const corner = await center(windowNamed(page, 'Nest').locator('.omni-resize-sw'));
  await drag(page, corner, { x: corner.x - 50, y: corner.y + 40 });
  const after = await box(page, windowNamed(page, 'Nest'));
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.height).toBeGreaterThan(before.height);
});

test('Tile fills every cell, windows and widgets alike', async ({ page }) => {
  await button(page, 'Add window').click();
  await button(page, 'Add widget').click();
  await button(page, 'Tile').click();
  // Nest has a maximum size (480 × 320), so it stays smaller than its cell; everything else fills its cell
  const items = page.locator('omni-window:not([aria-label="Nest"])');
  const sizes = new Set<string>();
  for (let i = 0; i < (await items.count()); i++) {
    const rect = await box(page, items.nth(i));
    expect(rect.width).toBeGreaterThan(300);
    expect(rect.height).toBeGreaterThan(200);
    sizes.add(`${rect.width}x${rect.height}`);
  }
  expect(sizes.size).toBeLessThanOrEqual(2);
  await expect(page.locator('.log li').first()).toHaveText('Tile (all): 5 arranged');
});

test('Tile arranges a desktop that has only widgets open', async ({ page }) => {
  await button(page, 'Add widget').click();
  await button(page, 'Add widget').click();
  for (const name of ['Angular', 'Nest', 'Notes']) await windowButton(page, name, 'Close').click();
  await button(page, 'Tile').click();
  const widgets = page.locator('omni-window.omni-window-widget');
  for (let i = 0; i < 2; i++) expect((await box(page, widgets.nth(i))).width).toBeGreaterThan(500);
  await expect(page.locator('.log li').first()).toHaveText('Tile (all): 2 arranged');
});

test('Cascade stacks the windows diagonally', async ({ page }) => {
  await button(page, 'Cascade').click();
  const xs = [];
  for (const name of ['Angular', 'Nest', 'Notes']) xs.push((await box(page, windowNamed(page, name))).x);
  xs.sort((a, b) => a - b);
  expect(xs[1] - xs[0]).toBe(32);
  expect(xs[2] - xs[1]).toBe(32);
});

test('Show desktop hides the windows and Bring back returns them', async ({ page }) => {
  await button(page, 'Show desktop').click();
  for (const name of ['Angular', 'Nest', 'Notes']) expect(await isAway(windowNamed(page, name))).toBe(true);
  await button(page, 'Bring back').click();
  for (const name of ['Angular', 'Nest', 'Notes']) expect(await isAway(windowNamed(page, name))).toBe(false);
});

test('minimizes into the dock and restores from the dock tab', async ({ page }) => {
  await windowButton(page, 'Nest', 'Minimize').click();
  await expect.poll(() => isAway(windowNamed(page, 'Nest'))).toBe(true);
  await dockTab(page, 'Nest').click();
  await expect.poll(() => isAway(windowNamed(page, 'Nest'))).toBe(false);
});

test('Restore all brings back every minimized window', async ({ page }) => {
  await windowButton(page, 'Angular', 'Minimize').click();
  await windowButton(page, 'Notes', 'Minimize').click();
  await button(page, 'Restore all').click();
  await expect.poll(() => isAway(windowNamed(page, 'Angular'))).toBe(false);
  await expect.poll(() => isAway(windowNamed(page, 'Notes'))).toBe(false);
});

test('maximize button: a click maximizes, resting on it opens the snap layouts', async ({ page }) => {
  await windowButton(page, 'Nest', 'Maximize').hover();
  await expect(page.locator('omni-snap-layouts')).toBeVisible();
  await page.locator('.omni-snap-zone[aria-label="Right half"]').click();
  await expect(page.locator('omni-snap-layouts')).toHaveCount(0);
  const desktop = (await page.locator('omni-desktop').boundingBox())!;
  expect((await box(page, windowNamed(page, 'Nest'))).x).toBeGreaterThan(desktop.width / 2 - 20);

  await windowButton(page, 'Angular', 'Maximize').click();
  await expect(windowNamed(page, 'Angular')).toHaveClass(/omni-window-maximized/);
});

test('keyboard: Tab reaches a title bar, arrows move the window, Alt+Z opens the snap layouts', async ({ page }) => {
  const header = windowNamed(page, 'Nest').locator('.omni-window-header');
  await header.focus();
  const before = await box(page, windowNamed(page, 'Nest'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect((await box(page, windowNamed(page, 'Nest'))).y).toBe(before.y + 20);

  await page.keyboard.press('Alt+KeyZ');
  await expect(page.locator('omni-snap-layouts')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('omni-snap-layouts')).toHaveCount(0);
  await expect(header).toBeFocused();
});

test('dock: arrow keys move between tabs', async ({ page }) => {
  await dockTab(page, 'Angular').focus();
  await page.keyboard.press('ArrowRight');
  await expect(dockTab(page, 'Nest')).toBeFocused();
  await page.keyboard.press('End');
  await expect(dockTab(page, 'Notes')).toBeFocused();
});

test('dock: badge and pinned window', async ({ page }) => {
  await button(page, 'Notify Angular').click();
  await button(page, 'Notify Angular').click();
  await expect(dockTab(page, 'Angular').locator('.omni-dock-badge')).toHaveText('2');

  await windowButton(page, 'Notes', 'Close').click();
  await expect(dockTab(page, 'Notes')).toHaveClass(/omni-dock-tab-closed/);
  await dockTab(page, 'Notes').click();
  await expect.poll(() => isAway(windowNamed(page, 'Notes'))).toBe(false);
});

test('grid: with a 20px grid, dragging lands on grid lines', async ({ page }) => {
  const field = page.locator('label.field', { hasText: 'Grid' }).locator('input');
  await field.fill('20');
  const header = windowNamed(page, 'Angular').locator('.omni-window-header');
  const start = await center(header);
  await drag(page, start, { x: start.x + 137, y: start.y + 93 });
  const rect = await box(page, windowNamed(page, 'Angular'));
  expect(rect.x % 20).toBe(0);
  expect(rect.y % 20).toBe(0);
});

test('windows remember their place after a reload', async ({ page }) => {
  const header = windowNamed(page, 'Nest').locator('.omni-window-header');
  const start = await center(header);
  await drag(page, start, { x: start.x - 300, y: start.y + 150 });
  const moved = await box(page, windowNamed(page, 'Nest'));
  await page.waitForTimeout(600); // layouts are saved shortly after the last change
  await page.reload();
  await expect(windowNamed(page, 'Nest')).toBeVisible();
  expect(await box(page, windowNamed(page, 'Nest'))).toEqual(moved);
});

test('lazy content: Nest’s clock only exists while Nest is shown', async ({ page }) => {
  await expect(windowNamed(page, 'Nest').locator('.live-clock')).toBeVisible();
  await windowButton(page, 'Nest', 'Minimize').click();
  await expect(windowNamed(page, 'Nest').locator('.live-clock')).toHaveCount(0);
  await dockTab(page, 'Nest').click();
  await expect(windowNamed(page, 'Nest').locator('.live-clock')).toBeVisible();
});
