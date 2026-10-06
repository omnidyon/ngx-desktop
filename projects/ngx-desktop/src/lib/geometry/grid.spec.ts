import { gridMove, gridResize } from './grid';

describe('grid', () => {
  const bounds = { x: 0, y: 0, width: 800, height: 600 };
  const min = { width: 100, height: 50 };
  const max = { width: Infinity, height: Infinity };

  it('moves the top-left corner to the nearest grid point, keeping the size', () => {
    expect(gridMove({ x: 37, y: 52, width: 200, height: 100 }, 20, bounds)).toEqual({
      x: 40,
      y: 60,
      width: 200,
      height: 100,
    });
    expect(gridMove({ x: 29, y: 9, width: 200, height: 100 }, 20, bounds)).toEqual({
      x: 20,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it('counts grid lines from the bounds origin', () => {
    expect(gridMove({ x: 37, y: 52, width: 200, height: 100 }, 20, { ...bounds, x: 5, y: 5 })).toEqual({
      x: 45,
      y: 45,
      width: 200,
      height: 100,
    });
  });

  it('puts only the edges being resized on the grid', () => {
    const rect = { x: 13, y: 17, width: 207, height: 103 };
    expect(gridResize(rect, 'se', 20, bounds, min, max)).toEqual({ x: 13, y: 17, width: 207, height: 103 });
    expect(gridResize(rect, 'e', 20, bounds, min, max)).toEqual({ x: 13, y: 17, width: 207, height: 103 });
    expect(gridResize({ x: 20, y: 20, width: 207, height: 103 }, 'se', 20, bounds, min, max)).toEqual({
      x: 20,
      y: 20,
      width: 200,
      height: 100,
    });
    // west / north move the left / top edge, the opposite edge stays
    expect(gridResize({ x: 33, y: 47, width: 207, height: 113 }, 'nw', 20, bounds, min, max)).toEqual({
      x: 40,
      y: 40,
      width: 200,
      height: 120,
    });
  });

  it('leaves an edge where it is when the grid would break the size limits', () => {
    // 108 would snap to 100, below the minimum of 105
    expect(
      gridResize({ x: 0, y: 0, width: 108, height: 100 }, 'e', 20, bounds, { width: 105, height: 50 }, max)
    ).toEqual({
      x: 0,
      y: 0,
      width: 108,
      height: 100,
    });
    // 195 would snap to 200, above the maximum of 198
    expect(
      gridResize({ x: 0, y: 0, width: 195, height: 100 }, 'e', 20, bounds, min, { width: 198, height: 500 })
    ).toEqual({
      x: 0,
      y: 0,
      width: 195,
      height: 100,
    });
  });
});
