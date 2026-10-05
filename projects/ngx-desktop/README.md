# @omnidyon/ngx-desktop

A desktop-style window manager for Angular: draggable, resizable windows with snap-in-place, optional no-overlap layout, a dock and dialogs. Themeable via CSS variables.

> Work in progress. Full documentation (usage, inputs/outputs, snapping and overlap) will be added before the first release.

<details><summary><b style="font-size: 20px;">Styling</b></summary>

When installed, windows, dialogs and the dock come in a default style. You can restyle them by defining any of the
values below on the component itself or on any ancestor element (for example `omni-desktop`, `body` or `:root`).

| Variable                          | Meaning                                                  | Default            |
| --------------------------------- | -------------------------------------------------------- | ------------------ |
| --omni-window-width               | initial window width (unless the `width` input is set)   | 50%                |
| --omni-window-height              | initial window height (unless the `height` input is set) | 50%                |
| --omni-window-background          | window background                                        | rgb(49, 31, 49)    |
| --omni-window-border-color        | window border color                                      | grey               |
| --omni-window-border-width        | window border width                                      | 1px                |
| --omni-window-border-radius       | window corner radius                                     | 20px               |
| --omni-window-header-height       | header height                                            | 30px               |
| --omni-window-header-background   | header background                                        | #40303f            |
| --omni-window-header-text-color   | header text and button color                             | rgb(200, 193, 193) |
| --omni-window-header-font-size    | header font size                                         | 18px               |
| --omni-window-header-font-weight  | header font weight                                       | 200                |
| --omni-window-content-color       | content and footer text color                            | rgb(200, 193, 193) |
| --omni-window-content-padding     | content padding                                          | 5px                |
| --omni-window-icon-size           | max size of the header icon                              | 24px               |
| --omni-window-button-size         | size of the header buttons                               | 20px               |
| --omni-window-resize-color        | color of the resize grip                                 | grey               |
| --omni-window-collapsed-width     | width of a minimized window outside a desktop            | 105px              |
| --omni-window-transition-duration | open/close/minimize animation duration                   | 300ms              |
| --omni-dialog-background          | dialog background                                        | rgb(86, 60, 86)    |
| --omni-dialog-overlay-color       | modal overlay color                                      | rgba(0, 0, 0, 0.4) |
| --omni-dialog-width               | dialog width                                             | 40%                |
| --omni-dialog-max-height          | dialog maximum height                                    | 80%                |
| --omni-dock-background            | dock background                                          | #18171780          |
| --omni-dock-tab-background        | dock tab background                                      | #11010180          |
| --omni-dock-tab-hover-background  | dock tab background on hover                             | black              |
| --omni-dock-active-tab-background | background of tabs whose window is minimized             | #43393980          |
| --omni-dock-text-color            | dock tab text color, focused tab border                  | grey               |
| --omni-dock-tab-size              | dock tab width and height                                | 40px               |
| --omni-dock-border-radius         | dock corner radius                                       | 20px               |
| --omni-dock-padding               | dock padding and gap between tabs                        | 5px                |

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
