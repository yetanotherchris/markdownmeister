# Data Model: Editor Visual Fixes

**Feature**: 028-editor-visual-fixes | **Date**: 2026-08-10

Neither fix persists state or introduces a new entity. This document models the
two visual entities from the spec's "Key Entities" section and their invariants.

## Entities

### Editor canvas colour (spec: Key Entities)

The theme's background palette value that fills the editing surface behind the
document content.

| Property | Value | Source |
|----------|-------|--------|
| Token | `--crepe-color-background` | set per theme by `src/renderer/editor/themes.css` and the custom-theme inline tokens in `App.tsx` |
| Applied to | `.milkdown` (Crepe root) | `@milkdown/crepe` reset.css |
| Full-height rule | `.editor-host .milkdown { min-height: 100% }` | NEW in `src/renderer/editor/editor.css` (D1) |

The `.editor-area` background (`--mm-editor-bg`) is only visible when no document
canvas is mounted (empty state); with a document open the canvas fills the whole
editor region, so no out-of-palette colour shows behind or below the content
(FR-001/002).

### View-source glyph (spec: Key Entities)

The heroicons `code-bracket-square` outline glyph used by the view-source action,
rendered in a dark-blue colour.

| Property | Value | Source |
|----------|-------|--------|
| Path | `M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25…Z` (24px outline) | `@heroicons/react` 24/outline (R3) |
| Colour token | `--mm-view-source: #2563eb` | NEW in `src/renderer/App.css` `:root` (D2, R2) |
| Top-bar instance | raw SVG string in `CrepeHost.tsx` | `buildTopBar` → `view` group (unchanged placement) |
| Context-menu instance | none — plain text item | "View source" keeps its label, no glyph (spec clarification 2026-08-10) |

## State transitions

| Transition | Action | Effect |
|-----------|--------|--------|
| Document shorter than the viewport | render / theme change | `.milkdown` stretches to the full editor host; canvas colour fills edge to edge (FR-001) |
| Document longer than the viewport | scroll | canvas colour extends behind the content; no other colour at the edges (FR-001 scenario 4) |
| Editor theme changes (any preset or custom) | settings Save | the full-height canvas re-paints in the new theme's canvas colour with no residual patch (FR-003, US1 scenario 3) |
| View-source action inspected (either surface) | hover/inspect | the top bar shows the code-bracket-square glyph in `--mm-view-source` dark blue, legible on light and dark (FR-004/005/006); the context-menu item stays a plain text label |

## Invariants

- The canvas fill rule never changes theme *values* — it only stretches the
  element that already carries the theme's background (spec-016 FR-005 holds).
- The view-source colour is a single token identical in both light and dark modes
  (FR-005/006, spec Assumption).
- No document content, dirty state, undo history, or save behaviour is touched by
  either fix (constitution Principle III).
