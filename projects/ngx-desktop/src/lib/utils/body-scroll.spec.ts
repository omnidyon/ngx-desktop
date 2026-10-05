import { blockBodyScroll, unblockBodyScroll } from './body-scroll';

describe('body scroll blocking', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('blocks and restores the previous overflow value', () => {
    document.body.style.overflow = 'scroll';
    blockBodyScroll(document, 'a');
    expect(document.body.style.overflow).toBe('hidden');
    unblockBodyScroll(document, 'a');
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('keeps scrolling blocked until the last owner unblocks', () => {
    blockBodyScroll(document, 'a');
    blockBodyScroll(document, 'b');
    unblockBodyScroll(document, 'a');
    expect(document.body.style.overflow).toBe('hidden');
    unblockBodyScroll(document, 'b');
    expect(document.body.style.overflow).toBe('');
  });

  it('ignores unblocking by an owner that never blocked', () => {
    blockBodyScroll(document, 'a');
    unblockBodyScroll(document, 'unknown');
    expect(document.body.style.overflow).toBe('hidden');
    unblockBodyScroll(document, 'a');
  });

  it('counts the same owner only once', () => {
    blockBodyScroll(document, 'a');
    blockBodyScroll(document, 'a');
    unblockBodyScroll(document, 'a');
    expect(document.body.style.overflow).toBe('');
  });
});
