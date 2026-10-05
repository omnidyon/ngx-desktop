import { clampRect, intersects, moveRect } from './rect';

describe('rect geometry', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };

  describe('clampRect', () => {
    it('returns the rect unchanged when it is inside the bounds', () => {
      const rect = { x: 10, y: 20, width: 100, height: 50 };
      expect(clampRect(rect, bounds)).toEqual(rect);
    });

    it('shifts a rect that leaves the bounds on the top/left', () => {
      expect(clampRect({ x: -30, y: -5, width: 100, height: 50 }, bounds)).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
    });

    it('shifts a rect that leaves the bounds on the bottom/right', () => {
      expect(clampRect({ x: 950, y: 790, width: 100, height: 50 }, bounds)).toEqual({
        x: 900,
        y: 750,
        width: 100,
        height: 50,
      });
    });

    it('shrinks a rect that is larger than the bounds', () => {
      expect(clampRect({ x: 50, y: 50, width: 2000, height: 900 }, bounds)).toEqual(bounds);
    });

    it('respects a bounds origin other than 0,0', () => {
      const offset = { x: 100, y: 100, width: 200, height: 200 };
      expect(clampRect({ x: 0, y: 250, width: 50, height: 50 }, offset)).toEqual({
        x: 100,
        y: 250,
        width: 50,
        height: 50,
      });
    });
  });

  describe('moveRect', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };

    it('moves by the delta without bounds', () => {
      expect(moveRect(start, -500, 40)).toEqual({ x: -400, y: 140, width: 200, height: 100 });
    });

    it('keeps the rect inside bounds when given', () => {
      expect(moveRect(start, -500, 2000, bounds)).toEqual({ x: 0, y: 700, width: 200, height: 100 });
    });

    it('does not mutate the start rect', () => {
      moveRect(start, 10, 10);
      expect(start).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    });
  });

  describe('intersects', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };

    it('detects overlapping rects', () => {
      expect(intersects(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
    });

    it('detects a rect fully inside another', () => {
      expect(intersects(a, { x: 10, y: 10, width: 10, height: 10 })).toBe(true);
    });

    it('does not count rects that only touch along an edge', () => {
      expect(intersects(a, { x: 100, y: 0, width: 50, height: 50 })).toBe(false);
      expect(intersects(a, { x: 0, y: 100, width: 50, height: 50 })).toBe(false);
    });

    it('does not count separate rects', () => {
      expect(intersects(a, { x: 200, y: 200, width: 10, height: 10 })).toBe(false);
    });
  });
});
