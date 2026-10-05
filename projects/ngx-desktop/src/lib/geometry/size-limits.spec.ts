import { limitSize, limitZoneRect } from './size-limits';

describe('size limits', () => {
  const min = { width: 130, height: 65 };
  const max = { width: 300, height: 200 };

  describe('limitSize', () => {
    it('keeps a size within the limits and keeps the position', () => {
      expect(limitSize({ x: 5, y: 6, width: 500, height: 40 }, min, max)).toEqual({
        x: 5,
        y: 6,
        width: 300,
        height: 65,
      });
      expect(limitSize({ x: 5, y: 6, width: 200, height: 100 }, min, max)).toEqual({
        x: 5,
        y: 6,
        width: 200,
        height: 100,
      });
    });

    it('lets the minimum win over a smaller maximum', () => {
      expect(limitSize({ x: 0, y: 0, width: 500, height: 500 }, min, { width: 100, height: 50 })).toEqual({
        x: 0,
        y: 0,
        width: 130,
        height: 65,
      });
    });
  });

  describe('limitZoneRect', () => {
    const half = { x: 0, y: 0, width: 500, height: 600 };
    const rightHalf = { x: 500, y: 0, width: 500, height: 600 };
    const bottomRight = { x: 500, y: 300, width: 500, height: 300 };

    it('keeps a zone that fits the maximum unchanged', () => {
      expect(limitZoneRect('left', half, { width: 1000, height: 1000 })).toEqual(half);
    });

    it('keeps the left half against the left and top edges', () => {
      expect(limitZoneRect('left', half, max)).toEqual({ x: 0, y: 0, width: 300, height: 200 });
    });

    it('keeps the right half against the right edge', () => {
      expect(limitZoneRect('right', rightHalf, max)).toEqual({ x: 700, y: 0, width: 300, height: 200 });
    });

    it('keeps a bottom-right quarter in the corner', () => {
      expect(limitZoneRect('bottomright', bottomRight, max)).toEqual({ x: 700, y: 400, width: 300, height: 200 });
    });
  });
});
