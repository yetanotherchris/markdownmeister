# Implementation Plan: Editor Visual Fixes

**Branch**: `phase-028-editor-visual-fixes` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-editor-visual-fixes/spec.md`

## Summary

Two carry-over visual fixes from the settings-redesign work (FR-001…FR-006):

1. **Full-height editor canvas** (US1, P1). For a short document the theme's
   canvas colour currently stops at the content height; below the last line the
   `.editor-area`'s `--mm-editor-bg` (white in light, dark surface in dark) shows
   through as a wrong-colour patch. The fix makes the Crepe `.milkdown` element
   fill the full height of the editor host (`min-height: 100%`), so the theme
   canvas colour extends from the top of the editor area to the bottom for every
   document length, every theme (including custom), and both light and dark modes.
2. **Recognisable view-source action** (US2, P2). The view-source glyph in the
   editor top bar (a generic chevron `>>`) is replaced with the heroicons
   **code-bracket-square** outline glyph rendered in a single curated **dark
   blue** colour (`--mm-view-source`), distinct from the accent token, in both the
   editor top bar and the explorer context menu.

Both fixes are renderer-only: a CSS rule plus an icon swap and a colour token. No
new IPC, no filesystem change, no settings change (Principles I & II untouched).

## Technical Context

**Language/Version**: TypeScript 5.8, strict, across main, preload and renderer.

**Primary Dependencies**: No new dependencies. The glyph is the heroicons
`code-bracket-square` outline shape, already present in the installed
`@heroicons/react@2.2.0` package (`24/outline/CodeBracketSquareIcon`). The editor
canvas surface is Crepe's `.milkdown` element (`@milkdown/crepe@7.21.3`), which
paints `background: var(--crepe-color-background)` (verified in
`node_modules/@milkdown/crepe/src/theme/common/reset.css`).

**Storage**: none — neither fix introduces or changes a persisted setting. The
dark-blue value is a CSS token in `:root`, matching the spec Assumption that the
exact value is a plan-level decision.

**Testing**: Vitest 4 (node/jsdom) for the existing unit suites; Playwright e2e
via `npm run test:e2e`. New e2e suite `tests/e2e/editor-visual-fixes.spec.ts`
covers the full-height canvas (short doc, theme change, long-doc scroll, dark
mode, custom theme) and the view-source glyph+colour in both the top bar and the
explorer context menu. The archived spec-014 `tests/e2e/view-source-icon.spec.ts`
is updated: its accent-colour assertions become dark-blue-token assertions (the
028 colour supersedes 014's, which is recorded in this plan's decision log).

**Target Platform**: Windows, macOS, Linux desktop.

**Project Type**: Desktop application (Electron), three build targets.

**Performance Goals**: nothing on the keystroke path; a single CSS rule and a
static token. No polling, no new runtime work.

**Constraints**: renderer sandboxed (no Node, no `fs`, no Electron module). No new
IPC operations. The theme canvas colour must keep coming from
`themes.css`/the custom inline tokens (FR-005 of spec 016) — the fix must not
duplicate theme values into a main-process or shared source. The view-source
behaviour, tooltip, and keyboard shortcut are unchanged (spec 014 FR-007).

**Scale/Scope**: one CSS rule in `src/renderer/editor/editor.css`, the heroicons
glyph swap in `src/renderer/editor/CrepeHost.tsx`, a dark-blue token in
`src/renderer/App.css`, and the code-bracket-square icon added to the "View
source" item of the explorer context menu (`src/renderer/explorer/Tree.tsx` +
`Tree.css`). Out of scope: the source-view surface (keeps app-theme styling,
spec 016 FR-013), the toolbar/icon behaviour, and any settings or IPC change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Process Isolation Is Absolute | Renderer-only change: a CSS rule, a static SVG string, a CSS token, and a React icon import. No new IPC, no `fs`, no Electron surface touched | **PASS** |
| II. Every Path Is Untrusted | No filesystem path crosses the IPC or the renderer boundary for this feature | **PASS** |
| III. Never Lose The User's Words | Neither fix touches documents, dirty state, save behaviour, or undo history. The canvas fill is a `min-height` on a background; the icon swap is presentational | **PASS** |
| IV. Calm, Predictable Editing | Canvas fill is a single static CSS rule (no reflow on the keystroke path); the icon swap is static markup. Toolbar label/tooltip/shortcut unchanged | **PASS** |
| V. Test What Can Corrupt Or Escape | No corrupt/escape vectors introduced. e2e verifies the full-height canvas across themes/modes/document lengths and the glyph+colour in both surfaces | **PASS** |

## Design Decisions

### D1: Fill the canvas by making `.milkdown` fill the host

The editor region is `.editor-area` → `.editor-host` (the scroll container,
`overflow: auto`, absolute, `height: 100%`) → a wrapper div (Crepe's root
container) → `.milkdown` (the Crepe root, `background:
var(--crepe-color-background)`). For a short document `.milkdown` is only as tall
as its content, so the transparent wrapper and `.editor-host` expose
`.editor-area`'s `--mm-editor-bg` below it. Adding

```css
.editor-host {
  display: flex;
  flex-direction: column;
}
.editor-host > div {
  min-height: 100%;
}
.editor-host .milkdown {
  min-height: 100%;
}
```

makes the Crepe root fill the host; its theme canvas background then spans the
whole editor region. Two structural facts drive the rule shape (verified live in
the built app, research R1): Crepe nests `.milkdown` inside the constructor root
div, so the wrapper must stretch too; and a percentage `min-height` needs a
definite-height parent, which the column-flex host provides to the wrapper (whose
specified height is otherwise `auto`). Because `.milkdown` is the scroll content,
a longer document still grows past 100% and scrolls with the canvas colour behind
it. The rule is theme-agnostic — it inherits whichever `--crepe-color-background`
the active theme (or custom inline tokens) define, so FR-001/002/003 hold for all
preset and custom themes in both light and dark modes.

### D2: A single curated dark-blue token, distinct from the accent

The spec Assumptions require one curated colour, distinct from the accent token,
legible on light and dark. The app's accent is `#d96b27` (light) / `#3794ff`
(dark), so the view-source colour is defined once in `:root` as
`--mm-view-source: #2563eb` and is NOT re-defined per `data-theme`. Contrast
checks (research R2): ≈5.2:1 on white, ≈3.9:1 on the light toolbar `#e0e0e0`,
≈3.2:1 on the dark context-menu surface `#1f1f1f`, ≈2.9:1 on the dark toolbar
`#262626` — the last reading just under 3:1, mitigated by the existing translucent
pill (now tinted with the same token) behind the glyph and the glyph's 24px size.

### D3: heroicons code-bracket-square, stroke-based, in both surfaces

The top-bar icon is injected as a raw SVG string into Crepe's `buildTopBar`
(`CrepeHost.tsx`). The context menu is React. Both use the identical
code-bracket-square path so the glyph is recognisably the same in both places
(FR-004, spec Assumption "both places use the same glyph and colour"). The
heroicons outline icon is stroke-based (`fill="none"`, `stroke="currentColor"`,
`stroke-width="1.5"`), so the CSS must colour it via `color`/`stroke` and force
`fill: none` (the existing override set `fill`, which would paint the square
solid). The context-menu "View source" item gains the same glyph via the
`CodeBracketSquareIcon` React component, coloured with the token.

### D4: keep the top-bar pill treatment, retinted

Spec 014 made the last top-bar item prominent with a translucent accent pill. 028
keeps that affordance but retints pill and glyph to the dark-blue token, keeping
the "deliberate colour" discoverability while satisfying FR-005/006. This is a
plan-level choice (the spec does not mention the pill); recorded in the decision
log.

## Project Structure

### Documentation (this feature)

```text
specs/028-editor-visual-fixes/
├── spec.md              # Requirements (FR-001…FR-006, US1–US2, edge cases)
├── plan.md              # This file
├── research.md          # R1…R3 evidence (canvas DOM, dark-blue contrast, heroicons glyph)
├── data-model.md        # The two visual entities and their invariants
├── quickstart.md        # Manual verification script
├── contracts/
│   └── renderer.md      # Canvas fill + view-source glyph/colour contract + e2e contract
└── tasks.md             # (/speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/
├── App.css                      # MODIFY: add --mm-view-source token to :root
├── editor/editor.css            # MODIFY: .editor-host .milkdown { min-height: 100% };
│                                #         last top-bar item pill+glyph retinted to token
├── editor/CrepeHost.tsx         # MODIFY: VIEW_SOURCE_ICON → heroicons code-bracket-square
└── explorer/
    ├── Tree.tsx                 # MODIFY: "View source" menu item gains the code-bracket-square glyph
    └── Tree.css                 # MODIFY: .context-menu-item-icon colour + sizing
```

```text
tests/e2e/
├── editor-visual-fixes.spec.ts  # NEW: 028 acceptance (canvas fill + glyph/colour)
└── view-source-icon.spec.ts     # MODIFY: 014 assertions accent → dark-blue token
```

**Structure decision**: the fixes live where the current rendering lives — the
canvas height rule in `editor.css` (co-located with the editor), the glyph in
`CrepeHost.tsx` (where Crepe's top bar is built), the token in the global
palette (`App.css :root`), and the context-menu glyph in the explorer's `Tree`.
No shared- or main-process file changes are needed.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| Two copies of the code-bracket-square path (raw SVG string for Crepe's `buildTopBar` + React component for the context menu) | Crepe's toolbar API takes an icon as an SVG *string*; the context menu renders React elements. Keeping one source would require a React renderer inside the toolbar or parsing the string in the menu — both worse | Inlining the path once in React and stringifying it for Crepe (a second, slightly different representation; also impossible without a render-to-string dependency) |
| Dark-blue contrast on the dark toolbar `#262626` is ≈2.9:1 (under the 3:1 non-text guideline) | The spec requires a *dark blue* that is also distinguishable on dark surfaces; a darker value (e.g. `#1d4ed8`) drops to ≈2.3:1, a brighter one (`#3b82f6`) stops reading as "dark blue". The chosen `#2563eb` plus the translucent pill and 24px glyph keeps the action clearly visible | Picking a theme-dependent colour (violates the single-curated-colour assumption) or a lighter blue (violates FR-005 wording) |

## Decision log

### 2026-08-10

- **Canvas fill via `min-height: 100%` on `.milkdown`** (D1): the single CSS rule
  satisfies FR-001/002/003 without touching theme values or the settings/IPC
  surface.
- **`--mm-view-source: #2563eb`** (D2): single curated dark blue, defined once in
  `:root`, distinct from the accent in both modes. Chosen after evaluating
  `#1d4ed8` (too dim on dark chrome) and `#3b82f6` (reads as light blue).
- **Icon treatment kept but retinted** (D4): the spec-014 translucent pill on the
  last top-bar item is retained and tinted with the token so the action stays
  prominent; the glyph colour assertion in the archived `view-source-icon.spec.ts`
  is updated to the token (028 supersedes 014's accent colour).
- **Context-menu glyph added** (D3): "View source" in the explorer context menu
  gains the same code-bracket-square glyph, coloured with the token (US2 scenario
  3).
