# Roadmap

Work goes one item at a time, each on its own branch, with tests, a real-browser check and a review before the next one.

## A. Polish

- [x] 1. Title ellipsis: long titles end in "…" (window and dialog); the full title is the tooltip
- [x] 2. Motion: honour `prefers-reduced-motion`, with `provideDesktopConfig({ motion })` to override; minimized
      windows fly into their dock tab; scaling happens in place
- [x] 3. Maximum size: `maxWidth` / `maxHeight` inputs (px or %), respected by resize, zones, layouts and `[(rect)]`
- [x] 4. Translatable labels via `provideDesktopConfig({ labels })` (plain object or a signal for runtime switching)

## B. Accessibility

- [x] 5. Keyboard focus brings a window to the front
- [x] 6. Keyboard move / resize / snap on the focused title bar (arrows, Shift, Ctrl, Alt; announced)
- [x] 7. Dock arrow-key navigation (single tab stop, arrows wrap, Home / End)

## C. Performance

- [x] 8. Dragging outside Angular's zone, batched per animation frame (pending move flushed on release)

## D. Features

- [x] 9. Desktop API from code (`#desk="omniDesktop"`, `injectDesktop()`: windows, focus, minimize / restore all, show desktop, close all, tile, cascade)
- [x] 10. Snap layouts on the maximize button (hover, long press, Alt+Z; halves, thirds, quarters, 2/3 + 1/3, main + side stack)
- [x] 11. Dock extras (left / right positions, badges, custom tab template, pinned windows)
- [x] 12. Widget extras: `<ng-template omniWindowContent>` rendered only while shown
- [-] 13. ~~Draggable dialogs~~ (dropped)
- [x] 14. Grid snapping (`[gridSize]` on the desktop, opt-in: drag, resize and arrow keys)

## E. Release

- [x] 15. Playwright end-to-end suite (`npm run e2e`, local Chrome, normal and reduced motion)
- [x] 16. Angular 22 compatibility check (22.2.1 + TypeScript 6.0: library build, 491 unit tests, examples build and 34 e2e runs pass; the Angular 21-built package works in an Angular 22 app)
- [ ] 17. README API reference and CHANGELOG (0.1.0), in the same structure as ngx-snippets:
  - root `README.md` is a landing page: badges, logo and tagline, links (Contributing · Submit an Issue ·
    Documentation), live demo, and short Documentation / Contributing / Development sections
  - `projects/ngx-desktop/README.md` is the documentation, in collapsible `<details>` sections (Installing, Usage
    Examples, configuration, Styling, …) plus the API reference

## F. Ecosystem

- [ ] 18. Public demo on GitHub Pages (manual deploy)
- [-] 19. ~~Move sgm onto the library~~ (dropped)
