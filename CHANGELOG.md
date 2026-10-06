# Changelog

All notable changes to `@omnidyon/ngx-desktop` are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [0.1.0] - unreleased

First release: the windows of sgm, rebuilt as a standalone, signal-based Angular 21 library.

### Added

- **Windows** (`<omni-window>`): drag by the title bar, resize from every edge and corner (mouse, pen and touch),
  minimize, maximize, full screen, close; header, footer and title slots; placement by `position`, `x` / `y` (px or %)
  and size (px or %); `minWidth` / `minHeight`, `maxWidth` / `maxHeight`; `[(rect)]`, `[(visible)]`,
  `[(minimized)]`, `[(maximized)]`; standalone windows outside a desktop.
- **Desktop** (`<omni-desktop>`): stacking order, a dock, snapping to zones (halves, quarters, maximize) and to other
  windows, `snapPadding`, `snapThreshold`, optional no-overlap layout (`allowOverlap`), grid snapping (`gridSize`).
- **Snap layouts** on the maximize button (hover, long press, Alt+Z): halves, thirds, quarters, 2/3 + 1/3 and more.
- **Desktop API**: `windows()`, `focus(id)`, `minimizeAll()`, `restoreAll()`, `toggleShowDesktop()`, `closeAll()`,
  `tile()` and `cascade()` (windows, widgets or both), via `#desk="omniDesktop"`, `viewChild` or `injectDesktop()`.
- **Widgets** (`widget`): no title bar, a grip on hover, no dock tab; `<ng-template omniWindowContent>` for content
  that only exists while shown.
- **Dock**: bottom, top, left or right; badges, pinned windows, a custom tab template (`omniDockTab`), arrow-key
  navigation; minimized windows fly into their tab.
- **Dialogs** (`<omni-dialog>`): modal or not, Escape to close, focus handling.
- **Persistence**: window layouts saved under `persistKey` (IndexedDB by default, replaceable storage) and sessions
  of windows opened at runtime (`injectDesktopSession`).
- **Keyboard and accessibility**: focus brings a window to the front; arrow keys move, Shift resizes, Ctrl snaps;
  screen reader announcements; translatable labels (`provideDesktopConfig({ labels })`).
- **Motion**: follows the system's reduced-motion setting; `provideDesktopConfig({ motion })` to override.
- **Theming**: CSS custom properties and seven themes (`default`, `aqua`, `discord`, `light`, `neo-san-francisco`,
  `neo-tokyo`, `twitch`).
- **Performance**: pointer tracking outside Angular's zone, one move per animation frame.
- Compatible with Angular 21 and 22.

[0.1.0]: https://github.com/omnidyon/ngx-desktop/releases/tag/v0.1.0
