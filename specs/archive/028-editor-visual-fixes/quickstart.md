# Quickstart: Editor Visual Fixes

**Feature**: 028-editor-visual-fixes | **Date**: 2026-08-10

Runnable validation guide proving the feature works end-to-end. For the design
rationale see `research.md`; for the entities/invariants see `data-model.md` and
`contracts/renderer.md`.

## Prerequisites

- Node + npm installed.
- `npm install` run at the repo root.

## Fixture

Create a scratch folder `~/vf-check/` containing:

`~/vf-check/short.md`:

```markdown
# Short
```

`~/vf-check/long.md` (a document long enough to scroll):

```markdown
# Long

This is line one.

<!-- repeat the paragraph below ~60 times -->
Paragraph with some body text that keeps the document taller than the window.
```

## Commands

### Unit tests (existing suites must stay green)

```sh
npm run typecheck
npm run lint
npm run test
```

Expected: all clean — neither fix changes shared, main, or renderer logic, so the
pre-existing suites pass unchanged.

### E2E (builds, then launches Electron via Playwright)

```sh
npm run test:e2e -- editor-visual-fixes
```

Expected: the new 028 suite passes, covering the full-height canvas (short doc,
theme change, long-doc scroll, dark mode, custom theme) and the view-source glyph
and colour in the top bar and the explorer context menu. Then run the full suite:

```sh
npm run test:e2e
```

Expected: green — including the updated `view-source-icon.spec.ts` (colour now the
dark-blue token) and `header-bar-shade.spec.ts` (canvas untouched).

## Manual walkthrough (dev)

```sh
npm run dev
```

1. **US1 — short doc, light**: Open `short.md`. The whole editor region below the
   single line is the Rustic cream `#fdf6e3`, edge to edge — no white patch.
2. **US1 — theme change**: Settings → Theme → Editor Theme → **Scholarly** →
   Save. The full-height canvas becomes white; no residual cream.
3. **US1 — long doc scroll**: Open `long.md` and scroll to the bottom. The canvas
   colour extends behind the content; no chrome/white band at the edges.
4. **US1 — dark mode**: Settings → Theme → **Dark**; Editor Theme → **Monotone**
   → Save. The canvas fills black (Monotone dark) top to bottom.
5. **US2 — top-bar glyph**: In the editor top bar, the last button shows the
   code-bracket-square shape in dark blue `#2563eb` (light and dark modes).
   Hovering still shows the "View source" tooltip.
6. **US2 — context menu**: Right-click a file in the explorer. The "View source"
   item shows the same code-bracket-square glyph in the same dark blue.

## Expected outcomes

- The canvas fills the whole editor region with the theme's canvas colour for any
  document length, any theme, and both modes (SC-001).
- The view-source action is recognisable as a dark-blue code-bracket-square in
  both the top bar and the context menu, legible on light and dark (SC-002).
