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

    it('returns thirds and two-thirds, the last column taking the rounding', () => {
      expect(zoneRect('leftthird', bounds)).toEqual({ x: 0, y: 0, width: 333, height: 800 });
      expect(zoneRect('centerthird', bounds)).toEqual({ x: 333, y: 0, width: 333, height: 800 });
      expect(zoneRect('rightthird', bounds)).toEqual({ x: 666, y: 0, width: 334, height: 800 });
      expect(zoneRect('lefttwothirds', bounds)).toEqual({ x: 0, y: 0, width: 666, height: 800 });
      expect(zoneRect('righttwothirds', bounds)).toEqual({ x: 333, y: 0, width: 667, height: 800 });
      expect(zoneRect('toprightthird', bounds)).toEqual({ x: 666, y: 0, width: 334, height: 400 });
      expect(zoneRect('bottomrightthird', bounds)).toEqual({ x: 666, y: 400, width: 334, height: 400 });
    });

    it('keeps the padding around and between thirds', () => {
      expect(zoneRect('leftthird', bounds, 10)).toEqual({ x: 10, y: 10, width: 320, height: 780 });
      expect(zoneRect('centerthird', bounds, 10)).toEqual({ x: 340, y: 10, width: 320, height: 780 });
      expect(zoneRect('rightthird', bounds, 10)).toEqual({ x: 670, y: 10, width: 320, height: 780 });
      expect(zoneRect('lefttwothirds', bounds, 10)).toEqual({ x: 10, y: 10, width: 650, height: 780 });
      expect(zoneRect('toprightthird', bounds, 10)).toEqual({ x: 670, y: 10, width: 320, height: 385 });
      expect(zoneRect('bottomrightthird', bounds, 10)).toEqual({ x: 670, y: 405, width: 320, height: 385 });
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

    describe('with padding', () => {
      const p = 10;

      it('keeps the padding from the bounds edges and between halves', () => {
        // 1000 wide: 10 | 485 | 10 | 485 | 10
        expect(zoneRect('left', bounds, p)).toEqual({ x: 10, y: 10, width: 485, height: 780 });
        expect(zoneRect('right', bounds, p)).toEqual({ x: 505, y: 10, width: 485, height: 780 });
      });

      it('keeps the padding between quarters', () => {
        // 800 high: 10 | 385 | 10 | 385 | 10
        expect(zoneRect('topleft', bounds, p)).toEqual({ x: 10, y: 10, width: 485, height: 385 });
        expect(zoneRect('bottomright', bounds, p)).toEqual({ x: 505, y: 405, width: 485, height: 385 });
      });

      it('leaves exactly the padding between neighbours for odd sizes', () => {
        const odd = { x: 0, y: 0, width: 301, height: 201 };
        const tl = zoneRect('topleft', odd, 7);
        const br = zoneRect('bottomright', odd, 7);
        expect(br.x - (tl.x + tl.width)).toBe(7);
        expect(br.y - (tl.y + tl.height)).toBe(7);
        expect(odd.width - (br.x + br.width)).toBe(7);
        expect(odd.height - (br.y + br.height)).toBe(7);
      });

      it('still maximizes to the whole bounds', () => {
        expect(zoneRect('maximize', bounds, p)).toEqual(bounds);
      });

      it('never returns negative sizes for huge padding', () => {
        const rect = zoneRect('left', { x: 0, y: 0, width: 20, height: 20 }, 50);
        expect(rect.width).toBeGreaterThanOrEqual(0);
        expect(rect.height).toBeGreaterThanOrEqual(0);
      });

      it('treats negative padding as none', () => {
        expect(zoneRect('left', bounds, -5)).toEqual(zoneRect('left', bounds));
      });
    });
  });
});
