import { magneticMove, magneticResize } from './magnetic-snap';

describe('magnetic snapping', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };
  const t = 16;
  const min = { width: 130, height: 65 };
  // A window sitting in the middle of the desktop.
  const other = { x: 400, y: 300, width: 200, height: 200 };

  describe('magneticMove', () => {
    it('leaves a rect alone when nothing is within the threshold', () => {
      const rect = { x: 100, y: 100, width: 100, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toEqual(rect);
    });

    it('snaps flush to the left side of another window', () => {
      // right edge at 390, other's left edge at 400
      const rect = { x: 290, y: 320, width: 100, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toMatchObject({ x: 300, y: 320 });
    });

    it('snaps flush to the right side of another window', () => {
      const rect = { x: 612, y: 320, width: 100, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toMatchObject({ x: 600 });
    });

    it('snaps flush below another window', () => {
      const rect = { x: 420, y: 510, width: 100, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toMatchObject({ y: 500 });
    });

    it('aligns edges of windows stacked on top of each other', () => {
      // directly below `other`, left edges 10px apart → aligned left edges
      const rect = { x: 410, y: 500, width: 150, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toMatchObject({ x: 400, y: 500 });
    });

    it('ignores windows that are far away on the other axis', () => {
      // x would align with `other`'s left edge, but it is 200px below it
      const rect = { x: 405, y: 700, width: 100, height: 50 };
      expect(magneticMove(rect, [other], null, t)).toEqual(rect);
    });

    it('snaps to the bounds edges', () => {
      expect(magneticMove({ x: 10, y: 785, width: 100, height: 10 }, [], bounds, t)).toMatchObject({ x: 0, y: 790 });
      expect(magneticMove({ x: 890, y: 8, width: 100, height: 10 }, [], bounds, t)).toMatchObject({ x: 900, y: 0 });
    });

    it('does not snap to the bounds when none are given', () => {
      const rect = { x: 10, y: 10, width: 100, height: 10 };
      expect(magneticMove(rect, [], null, t)).toEqual(rect);
    });

    it('picks the closest line when several are in range', () => {
      const a = { x: 200, y: 0, width: 100, height: 100 };
      const b = { x: 205, y: 100, width: 100, height: 100 };
      // left edge at 307: b's right edge (305) is closer than a's right edge (300)
      const rect = { x: 307, y: 50, width: 50, height: 50 };
      expect(magneticMove(rect, [a, b], null, t)).toMatchObject({ x: 305 });
    });

    it('never changes the size', () => {
      const rect = { x: 290, y: 320, width: 100, height: 100 };
      expect(magneticMove(rect, [other], bounds, t)).toMatchObject({ width: 100, height: 100 });
    });
  });

  describe('magneticResize', () => {
    it('snaps the dragged east edge to another window', () => {
      const rect = { x: 100, y: 320, width: 290, height: 100 };
      expect(magneticResize(rect, 'e', [other], bounds, t, min)).toEqual({ x: 100, y: 320, width: 300, height: 100 });
    });

    it('snaps the dragged west edge and keeps the east edge fixed', () => {
      const rect = { x: 610, y: 320, width: 200, height: 100 };
      expect(magneticResize(rect, 'w', [other], bounds, t, min)).toEqual({ x: 600, y: 320, width: 210, height: 100 });
    });

    it('only snaps the edges being dragged', () => {
      // left edge is 10px from other's right edge, but we drag the east edge
      const rect = { x: 610, y: 320, width: 200, height: 100 };
      expect(magneticResize(rect, 'e', [other], bounds, t, min)).toEqual(rect);
    });

    it('snaps both edges of a corner', () => {
      const rect = { x: 700, y: 600, width: 290, height: 190 };
      expect(magneticResize(rect, 'se', [], bounds, t, min)).toEqual({ x: 700, y: 600, width: 300, height: 200 });
    });

    it('skips a snap that would break the minimum size', () => {
      // snapping the west edge to 600 would leave 125px < 130px
      const rect = { x: 590, y: 320, width: 135, height: 100 };
      expect(magneticResize(rect, 'w', [other], bounds, t, min)).toEqual(rect);
    });
  });
});
