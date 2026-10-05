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
- [ ] 6. Keyboard move and resize
- [ ] 7. Dock arrow-key navigation

## C. Performance

- [ ] 8. Dragging outside Angular's zone, batched per animation frame

## D. Features

- [ ] 9. Desktop API from code (list, focus, minimize all, show desktop, tile, cascade)
- [ ] 10. Snap layouts on the maximize button
- [ ] 11. Dock extras (positions, badges, tab template, pinned items)
- [ ] 12. Widget extras (aspect ratio, render content only while visible)
- [ ] 13. Draggable dialogs
- [ ] 14. Grid snapping

## E. Release

- [ ] 15. Playwright end-to-end suite (`npm run e2e`, local)
- [ ] 16. Angular 22 compatibility check
- [ ] 17. README API reference and CHANGELOG (0.1.0), in the same structure as ngx-snippets:
  - root `README.md` is a landing page: badges, logo and tagline, links (Contributing · Submit an Issue ·
    Documentation), live demo, and short Documentation / Contributing / Development sections
  - `projects/ngx-desktop/README.md` is the documentation, in collapsible `<details>` sections (Installing, Usage
    Examples, configuration, Styling, …) plus the API reference

## F. Ecosystem

- [ ] 18. Public demo on GitHub Pages (manual deploy)
- [ ] 19. Move sgm onto the library
