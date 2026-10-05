import { Rect } from '../models/types';
import { fitWithoutOverlap, limitResize } from './fit';
import { intersects } from './rect';

describe('fitWithoutOverlap', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };
  const min = { width: 100, height: 50 };
  const other = { x: 400, y: 300, width: 200, height: 200 };

  it('returns the target when it overlaps nothing', () => {
    const target = { x: 50, y: 50, width: 200, height: 100 };
    expect(fitWithoutOverlap(target, [other], bounds, min)).toEqual(target);
  });

  it('keeps the target inside the bounds', () => {
    expect(fitWithoutOverlap({ x: -50, y: 790, width: 200, height: 100 }, [], bounds, min)).toEqual({
      x: 0,
      y: 700,
      width: 200,
      height: 100,
    });
  });

  it('moves the target flush to the nearest side of the window it overlaps', () => {
    // overlaps the left 30px of `other`
    expect(fitWithoutOverlap({ x: 230, y: 320, width: 200, height: 100 }, [other], bounds, min)).toEqual({
      x: 200,
      y: 320,
      width: 200,
      height: 100,
    });
    // overlaps the bottom 20px
    expect(fitWithoutOverlap({ x: 420, y: 480, width: 100, height: 100 }, [other], bounds, min)).toEqual({
      x: 420,
      y: 500,
      width: 100,
      height: 100,
    });
  });

  it('keeps the gap between windows', () => {
    expect(fitWithoutOverlap({ x: 230, y: 320, width: 200, height: 100 }, [other], bounds, min, 10)).toEqual({
      x: 190,
      y: 320,
      width: 200,
      height: 100,
    });
  });

  it('finds a corner spot when two windows block the straight moves', () => {
    const a = { x: 0, y: 0, width: 500, height: 400 };
    const b = { x: 500, y: 400, width: 500, height: 400 };
    // dropped across both: the free quarters are top-right and bottom-left
    const fitted = fitWithoutOverlap({ x: 450, y: 350, width: 300, height: 200 }, [a, b], bounds, min)!;
    expect(fitted).not.toBeNull();
    expect(intersects(fitted, a) || intersects(fitted, b)).toBe(false);
    expect(fitted).toMatchObject({ width: 300, height: 200 });
  });

  it('shrinks the target into the nearest free area when it does not fit at full size', () => {
    // only a 200 × 800 column is free on the right
    const wall = { x: 0, y: 0, width: 800, height: 800 };
    expect(fitWithoutOverlap({ x: 700, y: 100, width: 400, height: 300 }, [wall], bounds, min)).toEqual({
      x: 800,
      y: 100,
      width: 200,
      height: 300,
    });
  });

  it('never shrinks below the minimum size', () => {
    const wall = { x: 0, y: 0, width: 950, height: 800 };
    expect(fitWithoutOverlap({ x: 700, y: 100, width: 400, height: 300 }, [wall], bounds, min)).toBeNull();
  });

  it('returns null when the bounds are full', () => {
    expect(fitWithoutOverlap({ x: 10, y: 10, width: 100, height: 100 }, [bounds], bounds, min)).toBeNull();
  });

  it('never returns a rect that overlaps or leaves the bounds', () => {
    const windows: Rect[] = [
      { x: 100, y: 100, width: 300, height: 200 },
      { x: 500, y: 50, width: 250, height: 300 },
      { x: 200, y: 450, width: 400, height: 250 },
      { x: 700, y: 500, width: 250, height: 250 },
    ];
    for (let x = -100; x <= 1000; x += 75) {
      for (let y = -100; y <= 800; y += 75) {
        const fitted = fitWithoutOverlap({ x, y, width: 220, height: 160 }, windows, bounds, min, 5);
        if (!fitted) continue;
        expect(fitted.x >= 0 && fitted.y >= 0).toBe(true);
        expect(fitted.x + fitted.width <= 1000 && fitted.y + fitted.height <= 800).toBe(true);
        for (const w of windows) {
          expect(intersects(fitted, { x: w.x - 5, y: w.y - 5, width: w.width + 10, height: w.height + 10 })).toBe(
            false
          );
        }
      }
    }
  });
});

describe('limitResize', () => {
  const start = { x: 100, y: 100, width: 200, height: 100 };
  const right = { x: 400, y: 120, width: 100, height: 100 };
  const below = { x: 150, y: 300, width: 100, height: 100 };

  it('stops the east edge at a window beside it', () => {
    expect(limitResize({ ...start, width: 400 }, start, 'e', [right])).toEqual({ ...start, width: 300 });
  });

  it('stops the south edge at a window below it', () => {
    expect(limitResize({ ...start, height: 400 }, start, 's', [below])).toEqual({ ...start, height: 200 });
  });

  it('stops the west and north edges', () => {
    const left = { x: 0, y: 100, width: 50, height: 100 };
    const above = { x: 100, y: 0, width: 100, height: 60 };
    expect(limitResize({ x: 0, y: 0, width: 300, height: 200 }, start, 'nw', [left, above])).toEqual({
      x: 50,
      y: 60,
      width: 250,
      height: 140,
    });
  });

  it('keeps the gap', () => {
    expect(limitResize({ ...start, width: 400 }, start, 'e', [right], 10)).toEqual({ ...start, width: 290 });
  });

  it('stops a corner resize at a window diagonally in the way', () => {
    const diagonal = { x: 350, y: 250, width: 100, height: 100 };
    const result = limitResize({ ...start, width: 300, height: 200 }, start, 'se', [diagonal]);
    expect(intersects(result, diagonal)).toBe(false);
  });

  it('ignores windows that are not in the way of the moving edge', () => {
    const resized = { ...start, width: 400 };
    expect(limitResize(resized, start, 'e', [below])).toEqual(resized);
    expect(limitResize(resized, start, 's', [right])).toEqual(resized);
  });

  it('ignores windows that already overlapped when the resize started', () => {
    const overlapping = { x: 250, y: 150, width: 200, height: 100 };
    const resized = { ...start, width: 400 };
    expect(limitResize(resized, start, 'e', [overlapping])).toEqual(resized);
  });
});
