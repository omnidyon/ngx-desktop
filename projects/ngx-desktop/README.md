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

<details><summary><b style="font-size: 20px;">Styling</b></summary>

When installed, windows, dialogs and the dock come in a default style. You can restyle them by defining any of the
values below on the component itself or on any ancestor element (for example `omni-desktop`, `body` or `:root`).

| Variable                          | Meaning                                                  | Default                   |
| --------------------------------- | -------------------------------------------------------- | ------------------------- |
| --omni-window-width               | initial window width (unless the `width` input is set)   | 50%                       |
| --omni-window-height              | initial window height (unless the `height` input is set) | 50%                       |
| --omni-window-background          | window background                                        | rgb(49, 31, 49)           |
| --omni-window-border-color        | window border color                                      | grey                      |
| --omni-window-border-width        | window border width                                      | 1px                       |
| --omni-window-border-radius       | window corner radius                                     | 20px                      |
| --omni-window-header-height       | header height                                            | 30px                      |
| --omni-window-header-background   | header background                                        | #40303f                   |
| --omni-window-header-text-color   | header text and button color                             | rgb(200, 193, 193)        |
| --omni-window-header-font-size    | header font size                                         | 18px                      |
| --omni-window-header-font-weight  | header font weight                                       | 200                       |
| --omni-window-content-color       | content and footer text color                            | rgb(200, 193, 193)        |
| --omni-window-content-padding     | content padding                                          | 5px                       |
| --omni-window-icon-size           | max size of the header icon                              | 24px                      |
| --omni-window-button-size         | size of the header buttons                               | 20px                      |
| --omni-window-collapsed-width     | width of a minimized window outside a desktop            | 105px                     |
| --omni-window-transition-duration | open/close/minimize animation duration                   | 300ms                     |
| --omni-dialog-background          | dialog background                                        | rgb(86, 60, 86)           |
| --omni-dialog-overlay-color       | modal overlay color                                      | rgba(0, 0, 0, 0.4)        |
| --omni-dialog-width               | dialog width                                             | 40%                       |
| --omni-dialog-max-height          | dialog maximum height                                    | 80%                       |
| --omni-dock-background            | dock background                                          | #18171780                 |
| --omni-dock-tab-background        | dock tab background                                      | #11010180                 |
| --omni-dock-tab-hover-background  | dock tab background on hover                             | black                     |
| --omni-dock-active-tab-background | background of tabs whose window is minimized             | #43393980                 |
| --omni-dock-text-color            | dock tab text color, focused tab border                  | grey                      |
| --omni-dock-tab-size              | dock tab width and height                                | 40px                      |
| --omni-dock-border-radius         | dock corner radius                                       | 20px                      |
| --omni-dock-padding               | dock padding and gap between tabs                        | 5px                       |
| --omni-snap-preview-background    | fill of the snap preview shown while dragging            | rgba(255, 255, 255, 0.15) |
| --omni-snap-preview-border-color  | border of the snap preview                               | rgba(255, 255, 255, 0.6)  |

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
