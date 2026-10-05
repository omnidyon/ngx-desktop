import { uniqueId } from './unique-id';

describe('uniqueId', () => {
  it('returns different ids on every call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uniqueId()));
    expect(ids.size).toBe(50);
  });

  it('uses the given prefix', () => {
    expect(uniqueId('omni-window-')).toMatch(/^omni-window-\d+$/);
  });
});
