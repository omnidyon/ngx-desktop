import { TestBed } from '@angular/core/testing';
import { ForgottenLayouts } from './forgotten-layouts';

describe('ForgottenLayouts', () => {
  let forgotten: ForgottenLayouts;

  beforeEach(() => (forgotten = TestBed.inject(ForgottenLayouts)));

  it('knows nothing at first', () => {
    expect(forgotten.has('a')).toBe(false);
  });

  it('remembers forgotten keys until they are revived', () => {
    forgotten.forget('a');
    forgotten.forget('b');
    expect(forgotten.has('a')).toBe(true);
    forgotten.revive('a');
    expect(forgotten.has('a')).toBe(false);
    expect(forgotten.has('b')).toBe(true);
  });

  it('ignores reviving a key that was never forgotten', () => {
    forgotten.revive('x');
    expect(forgotten.has('x')).toBe(false);
  });

  it('is one registry for the whole app', () => {
    forgotten.forget('shared');
    expect(TestBed.inject(ForgottenLayouts).has('shared')).toBe(true);
  });
});
