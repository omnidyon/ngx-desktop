import { SnapZone } from '../models/types';
import { detectZone, zoneRect } from './snap-zones';

describe('snap zones', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };
  const t = 16; // threshold; corner areas are 4 × t = 64px

  describe('detectZone', () => {
    const cases: [string, { x: number; y: number }, SnapZone | null][] = [
      ['middle of the desktop', { x: 500, y: 400 }, null],
      ['left edge', { x: 5, y: 400 }, 'left'],
      ['right edge', { x: 995, y: 400 }, 'right'],
      ['top edge', { x: 500, y: 3 }, 'maximize'],
      ['bottom edge away from corners', { x: 500, y: 795 }, null],
      ['left edge near the top', { x: 5, y: 50 }, 'topleft'],
      ['left edge near the bottom', { x: 5, y: 760 }, 'bottomleft'],
      ['right edge near the top', { x: 995, y: 60 }, 'topright'],
      ['right edge near the bottom', { x: 995, y: 790 }, 'bottomright'],
      ['top edge near the left', { x: 40, y: 5 }, 'topleft'],
      ['top edge near the right', { x: 960, y: 5 }, 'topright'],
      ['bottom edge near the left', { x: 40, y: 795 }, 'bottomleft'],
      ['bottom edge near the right', { x: 960, y: 795 }, 'bottomright'],
      ['just outside the threshold', { x: t + 1, y: 400 }, null],
      ['exactly on the threshold', { x: t, y: 400 }, 'left'],
      ['pointer dragged beyond the left edge', { x: -40, y: 400 }, 'left'],
      ['pointer dragged above the desktop', { x: 500, y: -10 }, 'maximize'],
    ];

    for (const [name, pointer, zone] of cases) {
      it(`${name} → ${zone}`, () => {
        expect(detectZone(pointer, bounds, t)).toBe(zone);
      });
    }

    it('respects a bounds origin other than 0,0', () => {
      const offset = { x: 100, y: 50, width: 400, height: 300 };
      expect(detectZone({ x: 105, y: 200 }, offset, t)).toBe('left');
      expect(detectZone({ x: 50, y: 200 }, { ...offset, x: 0 }, t)).toBeNull();
    });
  });

  describe('zoneRect', () => {
    it('returns halves', () => {
      expect(zoneRect('left', bounds)).toEqual({ x: 0, y: 0, width: 500, height: 800 });
      expect(zoneRect('right', bounds)).toEqual({ x: 500, y: 0, width: 500, height: 800 });
    });

    it('returns quarters', () => {
      expect(zoneRect('topleft', bounds)).toEqual({ x: 0, y: 0, width: 500, height: 400 });
      expect(zoneRect('topright', bounds)).toEqual({ x: 500, y: 0, width: 500, height: 400 });
      expect(zoneRect('bottomleft', bounds)).toEqual({ x: 0, y: 400, width: 500, height: 400 });
      expect(zoneRect('bottomright', bounds)).toEqual({ x: 500, y: 400, width: 500, height: 400 });
    });

    it('returns the whole bounds for maximize', () => {
      expect(zoneRect('maximize', bounds)).toEqual(bounds);
    });

    it('covers odd sizes without gaps', () => {
      const odd = { x: 10, y: 20, width: 301, height: 201 };
      const left = zoneRect('topleft', odd);
      const right = zoneRect('bottomright', odd);
      expect(left.x + left.width).toBe(right.x);
      expect(left.y + left.height).toBe(right.y);
      expect(right.x + right.width).toBe(odd.x + odd.width);
      expect(right.y + right.height).toBe(odd.y + odd.height);
    });
  });
});
