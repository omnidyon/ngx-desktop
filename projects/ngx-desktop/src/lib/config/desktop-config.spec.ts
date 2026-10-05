import { TestBed } from '@angular/core/testing';
import { DEFAULT_DESKTOP_CONFIG, DESKTOP_CONFIG, provideDesktopConfig } from './desktop-config';

describe('desktop config', () => {
  it('defaults to DEFAULT_DESKTOP_CONFIG', () => {
    expect(TestBed.inject(DESKTOP_CONFIG)).toEqual(DEFAULT_DESKTOP_CONFIG);
  });

  it('merges partial overrides with the defaults', () => {
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ zIndex: { window: 10 } })] });
    expect(TestBed.inject(DESKTOP_CONFIG)).toEqual({
      zIndex: { window: 10, dock: DEFAULT_DESKTOP_CONFIG.zIndex.dock, dialog: DEFAULT_DESKTOP_CONFIG.zIndex.dialog },
      motion: 'system',
    });
  });

  it('sets the motion, keeping the default z-indexes', () => {
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ motion: 'none' })] });
    expect(TestBed.inject(DESKTOP_CONFIG)).toEqual({ zIndex: DEFAULT_DESKTOP_CONFIG.zIndex, motion: 'none' });
  });

  it('does not mutate the defaults', () => {
    TestBed.configureTestingModule({ providers: [provideDesktopConfig({ zIndex: { dock: 1 } })] });
    TestBed.inject(DESKTOP_CONFIG);
    expect(DEFAULT_DESKTOP_CONFIG.zIndex.dock).toBe(1500);
  });
});
