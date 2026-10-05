import { cascadeRects, tileRects } from './arrange';

describe('tileRects', () => {
  const bounds = { x: 0, y: 0, width: 800, height: 600 };

  it('returns nothing for no windows', () => {
    expect(tileRects(0, bounds, 'auto')).toEqual([]);
  });

  it('fills the bounds with a single window', () => {
    expect(tileRects(1, bounds, 'auto', 10)).toEqual([{ x: 10, y: 10, width: 780, height: 580 }]);
  });

  it('makes a grid, letting a shorter last row share the full width', () => {
    expect(tileRects(3, bounds, 'auto')).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 400, y: 0, width: 400, height: 300 },
      { x: 0, y: 300, width: 800, height: 300 },
    ]);
  });

  it('keeps the gap between cells and from the edges', () => {
    expect(tileRects(4, bounds, 'auto', 10)).toEqual([
      { x: 10, y: 10, width: 385, height: 285 },
      { x: 405, y: 10, width: 385, height: 285 },
      { x: 10, y: 305, width: 385, height: 285 },
      { x: 405, y: 305, width: 385, height: 285 },
    ]);
  });

  it('puts windows side by side or stacked', () => {
    expect(tileRects(2, bounds, 'columns')).toEqual([
      { x: 0, y: 0, width: 400, height: 600 },
      { x: 400, y: 0, width: 400, height: 600 },
    ]);
    expect(tileRects(2, bounds, 'rows')).toEqual([
      { x: 0, y: 0, width: 800, height: 300 },
      { x: 0, y: 300, width: 800, height: 300 },
    ]);
  });

  it('follows the bounds origin', () => {
    expect(tileRects(1, { x: 50, y: 20, width: 100, height: 100 }, 'auto')).toEqual([
      { x: 50, y: 20, width: 100, height: 100 },
    ]);
  });
});

describe('cascadeRects', () => {
  const bounds = { x: 0, y: 0, width: 800, height: 600 };

  it('offsets each window by the step, keeping its size', () => {
    const size = { width: 300, height: 200 };
    expect(cascadeRects([size, size, size], bounds, 30, 8)).toEqual([
      { x: 8, y: 8, width: 300, height: 200 },
      { x: 38, y: 38, width: 300, height: 200 },
      { x: 68, y: 68, width: 300, height: 200 },
    ]);
  });

  it('shrinks a window that would stick out at its place in the cascade', () => {
    const size = { width: 300, height: 500 };
    const rects = cascadeRects([size, size, size, size], bounds, 40);
    expect(rects.map((r) => [r.y, r.height])).toEqual([
      [0, 500],
      [40, 500],
      [80, 500],
      [120, 480],
    ]);
  });

  it('starts again at the top-left once the cascade is half-way down', () => {
    const size = { width: 100, height: 100 };
    const rects = cascadeRects(Array(10).fill(size), bounds, 100);
    expect(rects.map((r) => r.y)).toEqual([0, 100, 200, 300, 0, 100, 200, 300, 0, 100]);
  });

  it('shrinks a window larger than the bounds', () => {
    expect(cascadeRects([{ width: 2000, height: 100 }], bounds, 30, 10)).toEqual([
      { x: 10, y: 10, width: 780, height: 100 },
    ]);
  });
});
