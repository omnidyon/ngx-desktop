import { TestBed } from '@angular/core/testing';
import { USER_HAS_INTERACTED } from './user-activation';

describe('USER_HAS_INTERACTED', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userActivation');

  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, 'userActivation', original);
    else delete (globalThis.navigator as { userActivation?: unknown }).userActivation;
  });

  const stub = (hasBeenActive: boolean) =>
    Object.defineProperty(globalThis.navigator, 'userActivation', { value: { hasBeenActive }, configurable: true });

  it('follows the browser User Activation API', () => {
    const hasInteracted = TestBed.inject(USER_HAS_INTERACTED);
    stub(false);
    expect(hasInteracted()).toBe(false);
    stub(true);
    expect(hasInteracted()).toBe(true);
  });

  it('counts as interacted when the browser has no User Activation API', () => {
    delete (globalThis.navigator as { userActivation?: unknown }).userActivation;
    expect(TestBed.inject(USER_HAS_INTERACTED)()).toBe(true);
  });
});
