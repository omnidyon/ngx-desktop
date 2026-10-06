import { fitAspect, keepAspect } from './aspect-ratio';

describe('aspect ratio', () => {
  describe('fitAspect', () => {
    it('fits the largest size with the ratio', () => {
      expect(fitAspect({ width: 400, height: 400 }, 2)).toEqual({ width: 400, height: 200 });
      expect(fitAspect({ width: 400, height: 100 }, 2)).toEqual({ width: 200, height: 100 });
    });

    it('never goes below the minimum, keeping the ratio', () => {
      expect(fitAspect({ width: 100, height: 100 }, 2, { width: 300, height: 50 })).toEqual({
        width: 300,
        height: 150,
      });
      expect(fitAspect({ width: 100, height: 100 }, 1, { width: 50, height: 200 })).toEqual({
        width: 200,
        height: 200,
      });
    });
  });

  describe('keepAspect', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };
    const min = { width: 50, height: 25 };
    const noMax = { width: Infinity, height: Infinity };

    it('lets the height follow an east or west edge', () => {
      expect(keepAspect({ ...start, width: 300 }, start, 'e', 2, min, noMax)).toEqual({
        x: 100,
        y: 100,
        width: 300,
        height: 150,
      });
      // west: the right edge stays
      expect(keepAspect({ x: 0, y: 100, width: 300, height: 100 }, start, 'w', 2, min, noMax)).toEqual({
        x: 0,
        y: 100,
        width: 300,
        height: 150,
      });
    });

    it('lets the width follow a north or south edge, the bottom staying for north', () => {
      expect(keepAspect({ ...start, height: 150 }, start, 's', 2, min, noMax)).toEqual({
        x: 100,
        y: 100,
        width: 300,
        height: 150,
      });
      expect(keepAspect({ x: 100, y: 50, width: 200, height: 150 }, start, 'n', 2, min, noMax)).toEqual({
        x: 100,
        y: 50,
        width: 300,
        height: 150,
      });
    });

    it('follows the side that changed more at a corner, keeping the opposite corner', () => {
      // width +50% vs height +10%: the width decides
      expect(keepAspect({ x: 100, y: 100, width: 300, height: 110 }, start, 'se', 2, min, noMax)).toEqual({
        x: 100,
        y: 100,
        width: 300,
        height: 150,
      });
      // north-west: the bottom-right corner (300, 200) stays
      expect(keepAspect({ x: 0, y: 90, width: 300, height: 110 }, start, 'nw', 2, min, noMax)).toEqual({
        x: 0,
        y: 50,
        width: 300,
        height: 150,
      });
    });

    it('stays within the minimum and maximum size', () => {
      expect(keepAspect({ ...start, width: 1000 }, start, 'e', 2, min, { width: 400, height: 150 })).toEqual({
        x: 100,
        y: 100,
        width: 300,
        height: 150,
      });
      expect(keepAspect({ ...start, width: 10 }, start, 'e', 2, min, noMax)).toEqual({
        x: 100,
        y: 100,
        width: 50,
        height: 25,
      });
    });

    it('stays inside the bounds on both axes', () => {
      const bounds = { x: 0, y: 0, width: 1000, height: 300 };
      // growing east to 800 wide would need 400 high; only 200 is left below y = 100
      expect(keepAspect({ ...start, width: 800 }, start, 'e', 2, min, noMax, bounds)).toEqual({
        x: 100,
        y: 100,
        width: 400,
        height: 200,
      });
    });
  });
});
