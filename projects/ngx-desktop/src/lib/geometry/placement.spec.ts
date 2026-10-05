import { WindowPosition } from '../models/types';
import { placeRect } from './placement';

describe('placeRect', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };
  const size = { width: 200, height: 100 };

  const expected: Record<WindowPosition, [number, number]> = {
    topleft: [0, 0],
    top: [400, 0],
    topright: [800, 0],
    left: [0, 350],
    center: [400, 350],
    right: [800, 350],
    bottomleft: [0, 700],
    bottom: [400, 700],
    bottomright: [800, 700],
  };

  for (const [position, [x, y]] of Object.entries(expected) as [WindowPosition, [number, number]][]) {
    it(`places a window at ${position}`, () => {
      expect(placeRect(position, size, bounds)).toEqual({ x, y, ...size });
    });
  }

  it('offsets by the bounds origin', () => {
    expect(placeRect('topleft', size, { x: 50, y: 60, width: 500, height: 500 })).toEqual({ x: 50, y: 60, ...size });
  });

  it('shrinks a window that is larger than the bounds', () => {
    expect(placeRect('center', { width: 2000, height: 2000 }, bounds)).toEqual(bounds);
  });

  it('rounds half pixels', () => {
    expect(placeRect('center', { width: 201, height: 101 }, bounds)).toEqual({
      x: 400,
      y: 350,
      width: 201,
      height: 101,
    });
  });
});
