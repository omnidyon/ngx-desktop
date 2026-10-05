import { isWindowLayout, WindowLayout } from './window-layout';

const valid: WindowLayout = {
  version: 1,
  rect: { x: -20, y: 10, width: 300, height: 200 },
  zone: 'left',
  restoreSize: { width: 200, height: 100 },
  minimized: false,
  maximized: true,
  visible: true,
};

describe('isWindowLayout', () => {
  it('accepts a valid layout, with or without zone and restore size', () => {
    expect(isWindowLayout(valid)).toBe(true);
    expect(isWindowLayout({ ...valid, zone: null, restoreSize: null })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'layout'],
    ['another version', { ...valid, version: 2 }],
    ['no rect', { ...valid, rect: undefined }],
    ['a zero width', { ...valid, rect: { ...valid.rect, width: 0 } }],
    ['a negative height', { ...valid, rect: { ...valid.rect, height: -5 } }],
    ['an infinite x', { ...valid, rect: { ...valid.rect, x: Number.POSITIVE_INFINITY } }],
    ['a string y', { ...valid, rect: { ...valid.rect, y: '10' } }],
    ['an unknown zone', { ...valid, zone: 'center' }],
    ['a bad restore size', { ...valid, restoreSize: { width: 0, height: 10 } }],
    ['a non-boolean flag', { ...valid, minimized: 'no' }],
    ['a missing flag', { ...valid, visible: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isWindowLayout(value)).toBe(false);
  });
});
