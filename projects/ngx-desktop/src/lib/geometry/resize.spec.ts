import { resizeRect } from './resize';

describe('resizeRect', () => {
  const start = { x: 100, y: 100, width: 300, height: 200 };
  const min = { width: 130, height: 65 };
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };

  it('grows from the east edge', () => {
    expect(resizeRect(start, 'e', 50, 999, min)).toEqual({ x: 100, y: 100, width: 350, height: 200 });
  });

  it('grows from the south edge', () => {
    expect(resizeRect(start, 's', 999, 40, min)).toEqual({ x: 100, y: 100, width: 300, height: 240 });
  });

  it('moves the west edge and keeps the east edge fixed', () => {
    expect(resizeRect(start, 'w', -50, 0, min)).toEqual({ x: 50, y: 100, width: 350, height: 200 });
  });

  it('moves the north edge and keeps the south edge fixed', () => {
    expect(resizeRect(start, 'n', 0, 30, min)).toEqual({ x: 100, y: 130, width: 300, height: 170 });
  });

  it('resizes both axes from a corner', () => {
    expect(resizeRect(start, 'nw', -10, -20, min)).toEqual({ x: 90, y: 80, width: 310, height: 220 });
    expect(resizeRect(start, 'se', 10, 20, min)).toEqual({ x: 100, y: 100, width: 310, height: 220 });
    expect(resizeRect(start, 'ne', 10, -20, min)).toEqual({ x: 100, y: 80, width: 310, height: 220 });
    expect(resizeRect(start, 'sw', -10, 20, min)).toEqual({ x: 90, y: 100, width: 310, height: 220 });
  });

  it('never goes below the minimum size from the east/south', () => {
    expect(resizeRect(start, 'se', -1000, -1000, min)).toEqual({ x: 100, y: 100, width: 130, height: 65 });
  });

  it('never goes below the minimum size from the west/north, pinning the opposite edge', () => {
    expect(resizeRect(start, 'nw', 1000, 1000, min)).toEqual({ x: 270, y: 235, width: 130, height: 65 });
  });

  it('stops moving edges at the bounds', () => {
    expect(resizeRect(start, 'nw', -500, -500, min, bounds)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(resizeRect(start, 'se', 5000, 5000, min, bounds)).toEqual({ x: 100, y: 100, width: 900, height: 700 });
  });

  it('ignores the delta on the axis the direction does not touch', () => {
    expect(resizeRect(start, 'e', 0, 500, min, bounds)).toEqual(start);
  });
});
