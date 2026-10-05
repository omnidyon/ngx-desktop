# @omnidyon/ngx-desktop

A desktop-style window manager for Angular: draggable, resizable windows with snap-in-place, optional no-overlap layout, a dock and dialogs. Themeable via CSS variables.

> Work in progress. Full documentation (usage, inputs/outputs) will be added before the first release.

<details><summary><b style="font-size: 20px;">Snapping</b></summary>

Windows inside an `<omni-desktop>` snap into place while they are dragged:

- **Zones**: drag a window with the pointer to the left or right edge to fill that half of the desktop, into a
  corner for a quarter, or to the top edge to maximize. A preview shows where it will go. Dragging a snapped window out
  again gives it back its previous size.
- **Windows**: an edge that comes within `snapThreshold` px of another window's edge (or the desktop's edge) lines up
  with it, while moving and while resizing.

| `<omni-desktop>` input | Meaning                                                                     | Default |
| ---------------------- | --------------------------------------------------------------------------- | ------- |
| `snapToZones`          | snap to halves / quarters / maximize at the edges and corners               | `true`  |
| `snapToWindows`        | line edges up with other windows and the desktop edges                      | `true`  |
| `snapThreshold`        | distance in px at which edges and zones attract a window                    | `16`    |
| `snapPadding`          | gap in px kept around and between snapped windows and from the desktop edge | `0`     |

A single window can opt out with `[snappable]="false"`; `(snapped)` emits the zone (or `null` when dragged out).

```html
<omni-desktop [snapPadding]="8">
  <omni-window header="Editor" />
  <omni-window header="Preview" />
</omni-desktop>
```

</details>

<details><summary><b style="font-size: 20px;">Overlap</b></summary>

Set `[allowOverlap]="false"` on `<omni-desktop>` to keep windows from overlapping. The window you move, resize, snap,
open or restore adjusts; the other windows never move:

- **Dragging** onto another window: a preview shows where it will land (flush beside the windows it would overlap, or
  the nearest free spot); it goes there on release. Without room it goes back to where the drag started.
- **Snapping** into a zone that is partly taken: the window is placed beside the windows in the way, or shrunk into the
  free part (never below `minWidth` / `minHeight`).
- **Resizing** stops the edge at the next window.
- **Opening, restoring from the dock, a saved layout and `[rect]`** are fitted the same way when there is room.
- **Maximize and full screen** are exempt.

`snapPadding` is kept as the gap between windows. Windows that already overlapped before the setting was turned off
are left as they are.

```html
<omni-desktop [allowOverlap]="false" [snapPadding]="8">
  <omni-window header="One" />
  <omni-window header="Two" />
</omni-desktop>
```

</details>

<details><summary><b style="font-size: 20px;">Widget mode</b></summary>

`<omni-window widget>` shows a window without its title bar, for dashboards and tiles:

- A small **grip** appears at the top on hover (or keyboard focus) to move the widget; on touch screens it is always
  visible. Dragging the content itself does not move the widget, so charts, maps and text selection keep working.
- A small **close button** appears next to it when `closable` is on (the default); `[closable]="false"` hides it.
- **Resize handles**, snapping, `snapPadding`, `allowOverlap`, `x` / `y` / `[(rect)]`, `persistKey`, sessions, themes
  and scrollbars work as for windows.
- Widgets get **no dock tab** and no minimize / maximize / full-screen buttons. A widget minimized from code has no tab to
  come back from, so restore it from code too.
- For assistive technology a widget is a labelled `region` (its `header` is the label) instead of a `dialog`.

Normal windows and widgets can share a desktop. Building widgets from an API response:

<!-- prettier-ignore -->
```html
<omni-desktop [snapPadding]="8">
  @for (widget of widgets(); track widget.id) {
    <omni-window widget [header]="widget.title" [persistKey]="'widget-' + widget.id" [x]="widget.x" [y]="widget.y">
      @switch (widget.type) {
        @case ('chart') { <app-chart [data]="widget.data" /> }
        @case ('table') { <app-table [data]="widget.data" /> }
      }
    </omni-window>
  }
</omni-desktop>
```

The grip's background can be changed with `--omni-widget-grip-background`.

</details>

<details><summary><b style="font-size: 20px;">Positioning</b></summary>

Where a window starts, first match wins:

1. its saved layout (see _Persisting layout_)
2. `[rect]`
3. `x` / `y` / `width` / `height`, in px (`120`, `'120px'`) or as a percentage of the desktop (`'25%'`); an axis without
   `x` / `y` falls back to `position`
4. `position` (`center`, `top`, `topleft`, …) with the size from `--omni-window-width` / `--omni-window-height`

```html
<omni-window header="Logs" x="60%" y="40" width="480" height="30%" />
```

Limit the size with `minWidth` / `minHeight` (px, default 130 × 65) and `maxWidth` / `maxHeight` (px or a percentage
of the desktop, no limit by default). The limits apply to resizing, snapping into zones (a window that cannot fill a
zone keeps to its outer edge), saved layouts and `[(rect)]`; maximize still fills the desktop.

```html
<omni-window header="Preview" [minWidth]="240" maxWidth="50%" [maxHeight]="400" />
```

Bind `[(rect)]` to read the window's position and size live (it updates while dragging) or to move and resize it from
code. A rect set from code is kept inside the desktop when `keepInBounds` is on.

```html
<omni-window header="Inspector" [(rect)]="inspectorRect" />
```

</details>

<details><summary><b style="font-size: 20px;">Persisting layout</b></summary>

Give a window a `persistKey` and it remembers its position, size, snapped zone and minimized / maximized / closed state
across reloads. Keys must be unique per window.

```html
<omni-window header="Notes" persistKey="notes" />
```

- Layouts are stored in the browser's **IndexedDB** (database `omni-desktop`). Without IndexedDB (server-side rendering,
  some private modes) they are kept in memory and a single warning is logged.
- A saved snapped zone is re-fitted to the current desktop size; a saved rect is kept inside a smaller desktop.
- Saving happens a moment after the last change, never in the middle of a drag.
- **The saved state wins over the template:** a saved `visible`, `minimized` or `maximized` replaces the values set in
  the template (and two-way bindings such as `[(visible)]` are updated to match). A window the user closed therefore
  stays closed after a reload; if it is not part of a session, give users a way to reopen it with `[(visible)]` (the
  demo's "Reopen Notes" button does this).
- A desktop that is hidden (`display: none`, an inactive tab, a collapsed panel) does not shrink its windows; windows
  created while it is hidden are placed once it is shown.
- `window.forgetLayout()` deletes one saved layout; `inject(DESKTOP_LAYOUT_STORAGE).clear()` deletes all of them.

To store layouts elsewhere (for example on your backend, per user), implement `DesktopLayoutStorage` and provide it:

```ts
class ApiLayoutStorage implements DesktopLayoutStorage {
  load(key: string) {
    /* GET */
  }
  save(key: string, layout: WindowLayout) {
    /* PUT */
  }
  remove(key: string) {
    /* DELETE */
  }
  clear() {
    /* DELETE all */
  }
}

bootstrapApplication(App, { providers: [provideDesktopLayoutStorage(new ApiLayoutStorage())] });
```

`InMemoryLayoutStorage` is also exported, for tests.

</details>

<details><summary><b style="font-size: 20px;">Persisting dynamic windows (sessions)</b></summary>

`persistKey` restores where a window is, but windows your app creates at runtime (a "New document" button, say) also
need to remember that they _exist_. A **desktop session** keeps that list for you: you open windows with your own data,
render them from `session.windows()`, and they come back after a reload.

```ts
interface Doc {
  title: string;
}

export class App {
  readonly docs = injectDesktopSession<Doc>('documents'); // in an injection context

  newDoc() {
    this.docs.open({ title: 'Untitled' });
  }
}
```

<!-- prettier-ignore -->
```html
<omni-desktop>
  @for (doc of docs.windows(); track doc.key) {
    <omni-window [header]="doc.data.title" [persistKey]="doc.key" (closed)="docs.close(doc.key)">…</omni-window>
  }
</omni-desktop>
```

| Member              | Meaning                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `windows()`         | signal of `{ key, data }` for every window, in the order they were opened               |
| `loaded()`          | signal: the saved windows have been restored                                            |
| `open(data, key?)`  | adds a window and returns its key (a unique one is generated when you don't pass one)   |
| `update(key, data)` | replaces a window's data                                                                |
| `close(key)`        | removes a window **and forgets it**: it does not come back and its saved layout is gone |
| `clear()`           | closes every window of the session                                                      |
| `whenSaved()`       | resolves once pending changes are stored; await it before reloading or navigating away  |

- Use the window's `key` as its `persistKey`, so its position, size and state are restored too.
- `data` must be structured-cloneable: plain objects, arrays, strings, numbers, booleans, dates.
- Sessions are stored in IndexedDB (database `omni-desktop`, store `sessions`), with the same in-memory fallback as
  layouts. Use `provideDesktopSessionStorage(...)` to store them elsewhere; `InMemorySessionStorage` is exported for
  tests.
- Each session key should be used by one session at a time.

</details>

<details><summary><b style="font-size: 20px;">Motion</b></summary>

Windows open, close, minimize and restore with short animations. A window minimized inside a desktop shrinks into its
dock tab and grows back out of it when restored.

By default the animations follow the operating system: when it asks for reduced motion (Windows: _Settings →
Accessibility → Visual effects → Animation effects_ off; macOS: _Reduce motion_) nothing animates. Apps can override
that:

```ts
bootstrapApplication(App, { providers: [provideDesktopConfig({ motion: 'full' })] });
```

| `motion`   | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| `'system'` | animate unless the system asks for reduced motion (default) |
| `'full'`   | always animate                                              |
| `'none'`   | never animate                                               |

The animation length is `--omni-window-transition-duration` (see _Styling_).

</details>

<details><summary><b style="font-size: 20px;">Desktop API</b></summary>

A desktop can be controlled from code. Reach it with a template reference, `viewChild`, or `injectDesktop()` in a
component inside it (for example a toolbar in a window):

<!-- prettier-ignore -->
```html
<omni-desktop #desk="omniDesktop">...</omni-desktop>
<button (click)="desk.tile()">Tile</button>
<button (click)="desk.toggleShowDesktop()">{{ desk.showingDesktop() ? 'Bring back' : 'Show desktop' }}</button>
```

```ts
readonly desktop = viewChild.required(DesktopComponent);
// or, inside the desktop:
readonly desktop = injectDesktop(); // injectDesktop({ optional: true }) returns null outside one
```

| Member                      | What it does                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `windows()`                 | signal: every window and widget (`id`, `header`, `visible`, `minimized`, `maximized`, `rect`, `widget`, `persistKey`) |
| `focusedId()`               | signal: id of the window in front                                                                                     |
| `focus(id)`                 | shows a window (restoring it when minimized or closed) and brings it to the front                                     |
| `minimizeAll()`             | minimizes every `minimizable` window; widgets stay                                                                    |
| `restoreAll()`              | restores every minimized window                                                                                       |
| `toggleShowDesktop()`       | minimizes all windows; the next call restores the ones it minimized                                                   |
| `showingDesktop()`          | signal: windows hidden by `toggleShowDesktop()` are still minimized                                                   |
| `closeAll()`                | closes every `closable` window and widget                                                                             |
| `tile(mode?, { include? })` | arranges the open windows and widgets: `'auto'` (grid, default), `'columns'`, `'rows'`; returns how many it arranged  |
| `cascade({ include? })`     | stacks the open windows and widgets diagonally, keeping their sizes; returns how many it arranged                     |

`include` chooses what is arranged: `'all'` (default), `'windows'` or `'widgets'`, so a widget dashboard can be tidied on
its own:

```ts
desk.tile('auto', { include: 'widgets' });
desk.cascade({ include: 'windows' });
```

Minimized windows are never moved. `tile` and `cascade` keep `snapPadding` between items, respect each one's size
limits and un-maximize windows. With `allowOverlap` off, tiles make room for the open items they do not arrange, and
`cascade` does nothing and returns `0` (cascaded items overlap by design).

</details>

<details><summary><b style="font-size: 20px;">Keyboard</b></summary>

Every window's title bar (a widget's grip) is a tab stop. Focus moving into a window brings it to the front. On a
focused title bar:

| Keys                | Action                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Arrow keys          | move the window 10px (Alt: 1px)                                                        |
| Shift + arrow keys  | resize from the right / bottom edge 10px (Alt: 1px)                                    |
| Ctrl + Left / Right | snap to the left / right half                                                          |
| Ctrl + Up           | maximize                                                                               |
| Ctrl + Down         | restore a maximized or snapped window; otherwise minimize (focus goes to its dock tab) |

Keyboard moves and resizes follow the same rules as the mouse: bounds, minimum and maximum size, magnetic snapping
(only pulling the way the key goes, so a window can always step away from an edge) and no-overlap. They emit
`dragEnd`, `resizeStart` / `resizeEnd` and `snapped` like a drag. Screen readers hear the keys described on the title
bar and a short announcement after each change ("Notes moved to 120, 80"); both are translatable (see _Labels and
translation_).

The dock is a single tab stop (the last tab you used, or the focused window's). Arrow keys move between its tabs,
wrapping around; Home / End go to the first / last tab; Enter or Space restores or raises that window.

</details>

<details><summary><b style="font-size: 20px;">Labels and translation</b></summary>

The window buttons, the dock and its tabs have texts that screen readers announce. They are English by default and can
be translated; labels you leave out stay English:

```ts
bootstrapApplication(App, {
  providers: [provideDesktopConfig({ labels: { close: 'Schließen', minimize: 'Minimieren', dock: 'Fenster' } })],
});
```

To switch language at runtime, pass a signal (for example a `computed` over your translation service):

```ts
const labels = computed(() => ({ close: translate('close'), minimize: translate('minimize') }));
provideDesktopConfig({ labels });
```

| Label                  | Default                                 | Used for                                                           |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `close`                | `Close`                                 | close button of windows, widgets and dialogs                       |
| `minimize`             | `Minimize`                              | minimize button                                                    |
| `restore`              | `Restore`                               | minimize button while minimized                                    |
| `maximize`             | `Maximize`                              | maximize button                                                    |
| `restoreSize`          | `Restore size`                          | maximize button while maximized                                    |
| `fullScreen`           | `Full screen`                           | full-screen button                                                 |
| `exitFullScreen`       | `Exit full screen`                      | full-screen button while full screen                               |
| `dock`                 | `Windows`                               | the dock toolbar                                                   |
| `untitledWindow`       | `Window`                                | dock tab of a window without a `header`, `{name}` in announcements |
| `keyboardHelp`         | `Arrow keys move the window, …`         | read on a focused title bar (see _Keyboard_)                       |
| `announceMoved`        | `{name} moved to {x}, {y}`              | after a keyboard move                                              |
| `announceResized`      | `{name} resized to {width} by {height}` | after a keyboard resize                                            |
| `announceSnappedLeft`  | `{name} snapped to the left half`       | after Ctrl+Left                                                    |
| `announceSnappedRight` | `{name} snapped to the right half`      | after Ctrl+Right                                                   |
| `announceMaximized`    | `{name} maximized`                      | after Ctrl+Up                                                      |
| `announceRestored`     | `{name} restored`                       | after Ctrl+Down restores a maximized or snapped window             |

Placeholders in `{braces}` are filled in; keep them in translations.

</details>

<details><summary><b style="font-size: 20px;">Styling</b></summary>

When installed, windows, dialogs and the dock come in a default style. You can restyle them by defining any of the
values below on the component itself or on any ancestor element (for example `omni-desktop`, `body` or `:root`).

| Variable                            | Meaning                                                                             | Default                   |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------- |
| --omni-window-width                 | initial window width (unless the `width` input is set)                              | 50%                       |
| --omni-window-height                | initial window height (unless the `height` input is set)                            | 50%                       |
| --omni-window-background            | window background                                                                   | rgb(49, 31, 49)           |
| --omni-window-border-color          | window border color                                                                 | grey                      |
| --omni-window-border-width          | window border width                                                                 | 1px                       |
| --omni-window-border-radius         | window corner radius                                                                | 20px                      |
| --omni-window-header-height         | header height                                                                       | 30px                      |
| --omni-window-header-background     | header background                                                                   | #40303f                   |
| --omni-window-header-text-color     | header text and button color                                                        | rgb(200, 193, 193)        |
| --omni-window-header-font-size      | header font size                                                                    | 18px                      |
| --omni-window-header-font-weight    | header font weight                                                                  | 200                       |
| --omni-window-content-color         | content and footer text color                                                       | rgb(200, 193, 193)        |
| --omni-window-content-padding       | content padding                                                                     | 5px                       |
| --omni-window-icon-size             | max size of the header icon                                                         | 24px                      |
| --omni-window-button-size           | size of the header buttons                                                          | 20px                      |
| --omni-window-collapsed-width       | width of a minimized window outside a desktop                                       | 105px                     |
| --omni-window-transition-duration   | open/close/minimize animation duration (0s when the system asks for reduced motion) | 300ms                     |
| --omni-window-scrollbar-size        | width of the scrollbar inside windows and dialogs                                   | 8px                       |
| --omni-window-scrollbar-thumb       | scrollbar thumb colour                                                              | rgba(200, 193, 193, 0.35) |
| --omni-window-scrollbar-thumb-hover | scrollbar thumb colour on hover                                                     | rgba(200, 193, 193, 0.6)  |
| --omni-window-scrollbar-track       | scrollbar track colour                                                              | transparent               |
| --omni-widget-grip-background       | background of the widget grip and close button                                      | rgba(0, 0, 0, 0.35)       |
| --omni-dialog-background            | dialog background                                                                   | rgb(86, 60, 86)           |
| --omni-dialog-overlay-color         | modal overlay color                                                                 | rgba(0, 0, 0, 0.4)        |
| --omni-dialog-width                 | dialog width                                                                        | 40%                       |
| --omni-dialog-max-height            | dialog maximum height                                                               | 80%                       |
| --omni-dock-background              | dock background                                                                     | #18171780                 |
| --omni-dock-tab-background          | dock tab background                                                                 | #11010180                 |
| --omni-dock-tab-hover-background    | dock tab background on hover                                                        | black                     |
| --omni-dock-active-tab-background   | background of tabs whose window is minimized                                        | #43393980                 |
| --omni-dock-text-color              | dock tab text color, focused tab border                                             | grey                      |
| --omni-dock-tab-size                | dock tab width and height                                                           | 40px                      |
| --omni-dock-border-radius           | dock corner radius                                                                  | 20px                      |
| --omni-dock-padding                 | dock padding and gap between tabs                                                   | 5px                       |
| --omni-snap-preview-background      | fill of the snap preview shown while dragging                                       | rgba(255, 255, 255, 0.15) |
| --omni-snap-preview-border-color    | border of the snap preview                                                          | rgba(255, 255, 255, 0.6)  |

```scss
omni-desktop {
  --omni-window-border-radius: 8px;
  --omni-window-header-background: #1e293b;
}
```

</details>

<details><summary><b style="font-size: 20px;">Themes</b></summary>

`<omni-desktop>`, `<omni-window>` and `<omni-dialog>` accept a `theme` input. A theme set on a desktop applies to its
dock and every window inside it; a theme set on a window overrides the desktop's for that window.

Available themes: `default`, `aqua`, `discord`, `light`, `neo-san-francisco`, `neo-tokyo`, `twitch`.

```html
<omni-desktop theme="discord">
  <omni-window header="Uses discord" />
  <omni-window header="Uses aqua" theme="aqua" />
</omni-desktop>
```

</details>
