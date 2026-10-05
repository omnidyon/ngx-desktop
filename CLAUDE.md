# ngx-desktop

## What This Is

`@omnidyon/ngx-desktop` is an Angular library that provides a desktop-style window manager: draggable and resizable windows, snap-in-place (container zones + magnetic window edges), optional no-overlap layout, a dock (taskbar) and dialogs. Styling is done through typed CSS custom properties plus theme presets, following the pattern used in `@omnidyon/ngx-snippets`.

It was extracted from the window module of the `sgm` project (`sgm/src/app/modules/window/`) and modernised. `sgm` itself is not changed by work in this repo.

## Tech Stack

- **Framework**: Angular 21 (LTS), standalone components, signals
- **Packaging**: ng-packagr → `dist/ngx-desktop`, published to npm as `@omnidyon/ngx-desktop` (npm only: an Angular component library needs the compiled ng-packagr output, which JSR does not take)
- **Tests**: Angular unit-test builder (Vitest + jsdom)
- **Quality**: angular-eslint + typescript-eslint, Prettier
- **Runtime dependencies**: `tslib` only. Peer deps: `@angular/core`, `@angular/common` (`>=21.0.0 <23.0.0`)

## Workspace Structure

```
projects/ngx-desktop/   ← the library (all library code lives in src/lib/, public surface in src/public-api.ts)
projects/examples/      ← demo app consuming the library from source (path alias @omnidyon/ngx-desktop)
```

## Commands

```bash
npm start              # serve the examples app
npm run build          # build the library (ng-packagr)
npm test               # library unit tests (single run)
npm run test:examples  # examples app tests
npm run lint           # ESLint for both projects
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run publish:dry-run # lint, test, build, then show what npm would publish (publishes nothing)
```

## Mandatory Workflow Rules

These rules apply to every task. They are non-negotiable and must be followed without exception.

1. **New feature → spec file required.** Every new feature (component, directive, service, geometry function) must ship with a `*.spec.ts` next to it covering the primary happy path and the key error/edge cases. No feature is complete without its tests.
2. **Full test suite after every completed task.** Run `npm test` after every task. All tests must pass before moving on. If any test fails, fix it before considering the task done.
3. **All code must pass lint.** Every file you write — source and spec — must conform to the ESLint and Prettier rules. Run `npm run lint` and `npm run format:check` after writing code. Zero errors, zero warnings. Write clean code from the start instead of fixing violations later.
4. **Library must build.** Run `npm run build` after every task that touches `projects/ngx-desktop/`.
5. **Manual testing after feature completion.** After each feature, give the user detailed manual-testing instructions for the examples app (`npm start`) covering all functionality, edge cases (mouse and touch, container edges, minimum sizes, overlapping windows) and styling/theming. Wait for explicit confirmation that manual testing passed before moving on to the next task.
6. **Branch per feature/bug fix.** Create a new branch for every feature or bug fix before starting work. Only continue with the next task after the branch is merged.

## Angular Conventions

These rules apply to all Angular code in this repo (library and examples). They are non-negotiable and are enforced by ESLint where possible.

1. **SCSS only.** All styling is SCSS. Never create `.css` files; components reference `.scss` via `styleUrl`/`styleUrls`.
2. **Separate files.** Every component has separate `.component.ts`, `.component.html` and `.component.scss` files. Never use inline `template:` or `styles:` — always `templateUrl` and `styleUrl`.
3. **Signal APIs only.** Use `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`. Never use `@Input`, `@Output`, `EventEmitter`, `@ViewChild`, `@ContentChild(ren)` decorators.
4. **Signals for state.** Use `signal()`, `computed()` and `linkedSignal()` for component and service state. Do not use plain class properties for reactive state.
5. **Built-in control flow only.** Use `@if`, `@for` (always with `track`), `@switch`, `@let`. Never use `*ngIf`, `*ngFor`, `[ngSwitch]`.
6. **Standalone only.** No NgModules. Components use `ChangeDetectionStrategy.OnPush`.
7. **No Angular Material, no `@angular/cdk`.** Use plain HTML/SCSS and the library's own directives.
8. **No `@angular/animations`.** Use CSS transitions/keyframes together with Angular's `animate.enter` / `animate.leave`.
9. **Pointer Events.** Drag/resize/snap interactions use Pointer Events (with pointer capture) so mouse, pen and touch all work. Never use mouse-only events for interactions.
10. **Selector prefix.** Library components use the `omni-` element prefix; directives use the `omni` camelCase attribute prefix.

## Library Rules

1. **Public API.** Everything consumers may use is exported from `projects/ngx-desktop/src/public-api.ts` and documented with a `@publicApi` JSDoc tag. Internal helpers are tagged `@internal` and not exported.
2. **License header.** Every source file starts with the ISC license header used across Omnidyon libraries.
3. **Styling via CSS variables.** Component styles only read `var(--omni-*)`. Every new variable is declared as a typed `@property` with an initial value in `src/lib/styles/defaults.scss` **and** added to the Styling table in the README. Themes are preset classes in `src/lib/styles/themes.scss` that reassign variables; no `ngStyle`-object style inputs.
4. **Geometry is pure.** Snap/overlap calculations live in `src/lib/geometry/` as pure functions with no DOM access, so they are fully unit-testable.
5. **Licence in the package.** `projects/ngx-desktop/LICENSE.md` is a copy of the root `LICENSE.md` (ng-packagr cannot read files outside the library folder); keep them identical.
6. **No extra runtime dependencies.** Do not add packages to the library's `dependencies` or `peerDependencies` without explicit approval.

## Hard Rules

These rules override everything else. They are absolute and must never be violated.

1. **Context loss → full re-analysis.** If context is lost (session continuation, compaction, or uncertainty about the codebase state), re-read and re-analyze every relevant file before making any changes. Never guess or assume — verify by reading the actual code.
2. **Plan first, code never.** Before writing or modifying ANY code, present the full plan to the user and wait for explicit approval. The plan must state:
   - exactly which files will be created, modified or deleted
   - what changes will be made in each file
   - why each change is necessary
   - any packaging, publishing or breaking-change implications for consumers

   Do NOT start coding until the user explicitly confirms the plan. No exceptions.

3. **NEVER push without explicit user approval.** Do not run `git push` unless the user explicitly says "yes", "push" or "go ahead". Always ask "Should I push?" and wait. Batch the changes of a task into ONE commit.
4. **NEVER publish without explicit user approval.** Do not run `npm publish`, `publish-lib.sh`/`publish-lib.ps1` or `npm run publish:lib` unless the user explicitly approves that specific release. Dry runs (`npm run publish:dry-run`, `npm pack --dry-run`) are allowed.
