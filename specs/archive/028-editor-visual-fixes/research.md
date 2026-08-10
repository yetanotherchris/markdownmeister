# Research: Editor Visual Fixes

**Feature**: 028-editor-visual-fixes | **Date**: 2026-08-10

Evidence collected during planning. Each decision cites the check it rests on.

## R1 — The canvas-colour leak: DOM shape and the fix

The editor region's DOM is (verified in `src/renderer/App.tsx`,
`src/renderer/editor/EditorPanel.tsx`, `CrepeHost.tsx` and
`node_modules/@milkdown/crepe/src/core/builder.ts` + `@milkdown/core`
`internal-plugin/editor-view.ts`):

```text
.editor-area                 (flex: 1, position: relative, background: var(--mm-editor-bg))
└── .editor-host             (position: absolute; inset via top/left/width/height; overflow: auto)
    └── div                  (the container div passed to `new Crepe(...)`, no class)
        └── .milkdown        (Crepe root; background: var(--crepe-color-background))
            ├── .milkdown-top-bar
            └── .ProseMirror
```

- Crepe does NOT put the `milkdown` class on the container div it is handed.
  `@milkdown/core`'s `createViewContainer` (`internal-plugin/editor-view.ts`)
  creates a NEW `div.milkdown` and appends it INSIDE the container, then moves
  the editor's DOM into it. So the Crepe root is a child of the wrapper div, not
  a direct child of `.editor-host` — the wrapper must stretch too (research R1
  fix, verified live in the built app).
- `reset.css` paints `.milkdown` `background: var(--crepe-color-background)`.
- The theme blocks in `src/renderer/editor/themes.css` set
  `--crepe-color-background` per `.app-container[data-editor-theme=…] .milkdown`;
  the custom theme maps `--mm-custom-background` onto the same token. The source
  of the canvas colour is therefore already the `.milkdown` element's background.
- For a short document `.milkdown` is only as tall as its content, so the
  transparent wrapper and `.editor-host` expose `.editor-area`'s `--mm-editor-bg`
  below the last line — white in light, the dark chrome surface in dark. That is
  the "white/chrome patch" of US1.

**Fix**: `.editor-host` becomes a column flex container and both the Crepe wrapper
and the root stretch: `.editor-host > div { min-height: 100% }` and
`.editor-host .milkdown { min-height: 100% }` (in `editor.css`). This matters for
two reasons (verified live in the built app):

1. Crepe nests `.milkdown` inside the container div passed to its constructor
   (`editor-view.ts` `createViewContainer` appends a `.milkdown` div into the
   root), so the root is not a direct child of `.editor-host` — the wrapper in
   between must stretch too.
2. A percentage `min-height` only resolves against a parent with a *definite*
   height. The wrapper's specified height is `auto`, so `.milkdown { min-height:
   100% }` alone computes to `auto` and the canvas never fills. Making
   `.editor-host` a column flex container gives the wrapper a definite resolved
   flex-item height, so the child's percentage resolves against it. The
   `.editor-host > div` rule also matches the absolutely-positioned `.source-view`,
   which is `inset: 0` and therefore unaffected.

A longer document still grows past 100% and scrolls as before — the canvas colour
rides behind the content (FR-001 scenario 4). The rule is theme-agnostic: it needs
no knowledge of any theme's value, so it holds for the five presets, the custom
theme, and both light/dark modes (FR-003). Rejected alternatives: setting
`.editor-area`'s background to the theme token (would need to duplicate token
mapping outside `themes.css`), or a main-process/shared constant for canvas
colours (violates spec-016 FR-005 "values live in the renderer CSS").

## R2 — The dark-blue choice

Spec Assumptions: one curated colour, distinct from the accent token, legible on
light and dark (FR-006). The accent token is `#d96b27` (light) and `#3794ff`
(dark). The view-source surface is `.milkdown-top-bar` (background `--mm-header`:
`#e0e0e0` light / `#262626` dark) and the context menu (background `--mm-bg`:
`#ffffff` light / `#1f1f1f` dark).

Candidates, with approximate WCAG contrast against the two dark chrome surfaces:

| Value | On `#262626` (dark toolbar) | On `#1f1f1f` (dark menu) | Reads as |
|-------|-----------------------------|--------------------------|----------|
| `#1d4ed8` (blue-700) | ≈2.3:1 | ≈2.5:1 | dark blue, but dim on dark chrome |
| **`#2563eb` (blue-600)** | **≈2.9:1** | **≈3.2:1** | **dark royal blue, legible on both** |
| `#3b82f6` (blue-500) | ≈4.2:1 | ≈4.5:1 | bright blue — no longer reads as "dark blue" |

`#2563eb` is the chosen value. On light surfaces it is clearly a dark blue (≈5.2:1
on white, ≈3.9:1 on the light toolbar `#e0e0e0`). On dark chrome the ≈2.9:1
reading on the toolbar is just under the 3:1 non-text guideline; the glyph's 24px
size and stroke weight keep it distinguishable (plan D4 — the spec-014
translucent pill was removed at the user's request on 2026-08-10, so it is no
longer a mitigation). `#1d4ed8` was rejected for being too dim on the dark
toolbar; `#3b82f6` for not reading as dark blue. The value is defined once in
`:root` and intentionally NOT re-defined under `[data-theme='dark']` — the single
curated colour must be identical in both modes (FR-005/006).

## R3 — heroicons code-bracket-square is stroke-based

The installed `@heroicons/react@2.2.0` `24/outline/CodeBracketSquareIcon` (read
from `node_modules/@heroicons/react/24/outline/CodeBracketSquareIcon.js`) renders:

```html
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
     stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon">
  <path stroke-linecap="round" stroke-linejoin="round"
        d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25
           M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75
           H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
</svg>
```

Two consequences for the implementation:

1. **Stroke-based, not fill-based.** The outline glyph paints via `stroke`, so the
   top-bar CSS must colour it with `color`/`stroke` and force `fill: none` — the
   current override sets `fill: var(--mm-accent)`, which would paint the square
   solid. The existing `color: var(--mm-accent)` on the last top-bar item's `svg`
   becomes `color: var(--mm-view-source); stroke: var(--mm-view-source);
   fill: none`.
2. **The same path in both surfaces.** The editor top bar's icon is passed to
   Crepe's `buildTopBar` as an SVG *string* (`CrepeHost.tsx`), while the explorer
   context menu renders React elements (`Tree.tsx`). Using the same path string in
   both keeps the glyph identical (FR-004 / spec Assumption). The React
   component import in `Tree.tsx` renders the identical `<path d=…>`.

The toolbar label pipeline (`src/renderer/editor/toolbarLabels.ts`) labels the
view-source button by DOM order (`title`/`aria-label` = "View source"); the icon
swap does not change the control order or the labels, so the spec-014 FR-004
(accessible name/tooltip) is preserved without changes there.
