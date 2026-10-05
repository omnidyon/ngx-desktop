import { resolveLength } from './length';

describe('resolveLength', () => {
  it('passes numbers through', () => {
    expect(resolveLength(120, 1000)).toBe(120);
    expect(resolveLength(0, 1000)).toBe(0);
  });

  it('parses plain and px strings', () => {
    expect(resolveLength('120', 1000)).toBe(120);
    expect(resolveLength('120px', 1000)).toBe(120);
    expect(resolveLength(' 12.5 px ', 1000)).toBe(12.5);
  });

  it('resolves percentages of the total, rounded to whole pixels', () => {
    expect(resolveLength('25%', 1000)).toBe(250);
    expect(resolveLength('33.3%', 1000)).toBe(333);
    expect(resolveLength('50%', 801)).toBe(401);
  });

  it('keeps negative values (a window may start partly outside)', () => {
    expect(resolveLength(-20, 1000)).toBe(-20);
    expect(resolveLength('-10%', 1000)).toBe(-100);
  });

  it('returns undefined for missing values', () => {
    expect(resolveLength(undefined, 1000)).toBeUndefined();
    expect(resolveLength(null, 1000)).toBeUndefined();
    expect(resolveLength('', 1000)).toBeUndefined();
  });

  it('returns undefined for unsupported units and garbage', () => {
    expect(resolveLength('10em', 1000)).toBeUndefined();
    expect(resolveLength('abc', 1000)).toBeUndefined();
    expect(resolveLength('10 %%', 1000)).toBeUndefined();
    expect(resolveLength(Number.NaN, 1000)).toBeUndefined();
    expect(resolveLength(Number.POSITIVE_INFINITY, 1000)).toBeUndefined();
  });
});
