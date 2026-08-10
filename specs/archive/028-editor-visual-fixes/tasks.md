# Tasks: Editor Visual Fixes

**Feature**: `028-editor-visual-fixes` | **Date**: 2026-08-10

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/renderer.md](./contracts/renderer.md)

**Implementation strategy**: Both fixes are renderer-only and independent of each
other, so they can proceed in parallel once the baseline is green. Phase 2
implements US1 (full-height canvas) with its e2e coverage; Phase 3 implements US2
(dark-blue code-bracket-square view-source glyph in the top bar and the explorer
context menu) with its e2e coverage. Phase 4 updates the archived spec-014 e2e
suite (accent → dark-blue token), runs the full five-command gate (`npm run lint`,
`npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run check`), archives
the spec, and opens the phase PR.

The canvas-fill and glyph/colour contracts are pinned in `contracts/renderer.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the branch baseline before any change.

- [X] T001 Establish a green baseline on the `phase-028-editor-visual-fixes`
      branch (created from clean `main` per AGENTS.md): run `npm run lint`, `npm
      run typecheck`, `npm run test`, and confirm the e2e suite passes
      (`npm run test:e2e`). Record the results in this file. Confirm the artifacts
      (`spec.md`, `plan.md`, `research.md`, `data-model.md`,
      `contracts/renderer.md`, `quickstart.md`) are present and consistent.
      **Baseline (2026-08-10)**: lint 0, typecheck 0, 608 unit tests pass, 233 e2e
      tests pass.

**Checkpoint**: baseline green; artifacts present.

---

## Phase 2: User Story 1 — Full-height editor canvas (Priority: P1)

**Goal**: the active theme's canvas colour extends from the top of the editor area
to its bottom for any document length, in both light and dark modes and for every
theme including custom.

**Independent Test**: open a one-line document — the entire editor region below
the text shows the theme's canvas colour edge to edge (contract `Canvas fill`).

- [X] T002 [US1] Add `.editor-host .milkdown { min-height: 100% }` to
      `src/renderer/editor/editor.css` (D1). Verify the selector targets the Crepe
      root (`.milkdown` is the direct child of `.editor-host`) and that it does
      not affect the source view or the `.editor-host.has-source` overlay.
- [X] T003 [US1] Write `tests/e2e/editor-visual-fixes.spec.ts` (US1 portion,
      contract `E2e` items 1–5): short Rustic doc fills the host; theme change
      Rustic → Scholarly re-paints full-height with no residual patch; long-doc
      scroll keeps the canvas colour; dark mode + Monotone fills with the dark
      canvas colour; custom-theme config (spec 023 fixture pattern) fills
      full-height.

**Checkpoint**: `npm run typecheck` + `npm run test` pass; the US1 e2e tests in
`editor-visual-fixes.spec.ts` pass against the built app.

---

## Phase 3: User Story 2 — Dark-blue code-bracket-square view-source (Priority: P2)

**Goal**: the view-source action is recognisable by the heroicons
code-bracket-square glyph in a single curated dark blue (`--mm-view-source`), in
both the editor top bar and the explorer context menu.

**Independent Test**: open a document and inspect the view-source action in the
top bar and the context menu — the glyph is code-bracket-square, dark blue, in
both light and dark modes (contract `View-source glyph`).

- [X] T004 [US2] Add `--mm-view-source: #2563eb;` to the `:root` block in
      `src/renderer/App.css` (D2). Do NOT re-define it under
      `[data-theme='dark']` — the single curated colour must be identical in both
      modes (FR-005/006).
- [X] T005 [US2] Replace `VIEW_SOURCE_ICON` in `src/renderer/editor/CrepeHost.tsx`
      with the heroicons 24px `code-bracket-square` outline SVG string (R3). Keep
      the raw-string injection into `buildTopBar` (D3).
- [X] T006 [US2] In `src/renderer/editor/editor.css`, retint the last top-bar
      item: the pill background (`color-mix(... var(--mm-accent) ...)`) and the
      glyph (`color`/`fill`) become `var(--mm-view-source)`; the glyph rule sets
      `fill: none` and `stroke: var(--mm-view-source)` because the outline icon is
      stroke-based (R3). Update the spec-014 comment block to note the 028
      colour supersedes the accent (D4).
- [X] T007 [US2] In `src/renderer/explorer/Tree.tsx`, add the code-bracket-square
      glyph to the "View source" context-menu item: import
      `CodeBracketSquareIcon` from `@heroicons/react/24/outline` and render it
      before the label in `menuItem('View source', …)`. Add a
      `context-menu-item-icon` wrapper/class so the colour and size are applied
      (US2 scenario 3, FR-004).
- [X] T008 [US2] In `src/renderer/explorer/Tree.css`, style the
      `.context-menu-item-icon` (or equivalent) with
      `color: var(--mm-view-source)` and a size matching the menu row; keep the
      existing `.context-menu-item` layout.
- [X] T009 [US2] Extend `tests/e2e/editor-visual-fixes.spec.ts` with the US2
      portion (contract `E2e` items 6–7): the top-bar view-source glyph is
      code-bracket-square and its computed colour equals the `--mm-view-source`
      token (and differs from the accent) in both light and dark modes; the
      context-menu "View source" menuitem shows the same glyph in the same colour.

**Checkpoint**: `npm run typecheck` + `npm run test` pass; the US2 e2e tests pass
against the built app; the glyph renders in dark blue in both surfaces.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: final gate, archived-suite alignment, and archival.

- [X] T010 Update `tests/e2e/view-source-icon.spec.ts` (archived spec 014): replace
      the accent-colour assertions with `--mm-view-source` token assertions,
      keeping the structural checks (last top-bar item, tooltip/aria-label,
      distinctness from the muted Bold icon, dark-mode coverage). Update the file
      header comment to reference 028's colour decision (contract
      `Updated spec-014 suite`).
- [X] T011 Run the full gate: `npm run lint`, `npm run typecheck`, `npm run test`,
      `npm run test:e2e`, `npm run check`. Fix any violations.
      **Final gate (2026-08-10)**: lint 0, typecheck 0, 608 unit tests pass, 243
      e2e tests pass (233 baseline + 10 new), `npm run check` reports no
      violations. The pre-existing `native.spec.ts` US3 footer flake was observed
      once under full-suite load and passes in isolation (same class of flake as
      archived 016/004 notes); a clean full run is recorded above.
      **Post-review additions (code review 2026-08-10)**: e2e coverage extended
      to the spec's zero-content / single-character edge cases and to all five
      preset themes (SC-001); `research.md` R1 DOM diagram corrected to the
      actual `createViewContainer` nesting.
      **Follow-up changes (user request 2026-08-10)**: the view-source icon is a
      top-bar affordance only — the context-menu "View source" item is a plain
      text item (glyph + Tree.tsx/Tree.css icon styling reverted; spec US2
      clarified); the settings dialog pins `min-height: 440px` so General and
      Theme areas share a stable height (e2e asserted in `settings.spec.ts`); the
      file-preference label reads "Open files in a new tab" (tests + archived 008
      contract updated).
- [X] T012 Archive the spec: `git mv specs/028-editor-visual-fixes specs/archive/028-editor-visual-fixes`,
      set its `**Status**` to `Archived`, and update the Current implementation
      status table in `AGENTS.md`. Create the phase PR against `main` with an
      `AI usage:` line naming the contributing models.
      **Done (2026-08-10)**: spec archived (Status: Archived). No Current
      implementation status table exists in this repo's `AGENTS.md` (the
      template reference is stale), so there was nothing to update there. Phase
      PR: https://github.com/yetanotherchris/markdownmeister/pull/50

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — baseline first.
- **US1 (Phase 2)** and **US2 (Phase 3)**: both depend on Phase 1; each other's
  files are disjoint (US1: `editor.css`; US2: `App.css`, `CrepeHost.tsx`,
  `Tree.tsx`, `Tree.css`), so the two stories can proceed in parallel.
- **Polish (Phase 4)**: depends on Phases 2 and 3 (the 014-suite update depends on
  the new token existing; the gate runs last).

### Within Each Phase

- Implementation before its e2e verification, but the e2e spec file is written as
  one file per story phase (T003, T009) so each story is independently testable.

### Parallel Opportunities

- T002 (CSS) and T004–T008 (token + glyph + context menu) touch disjoint files and
  can run together.
- T009 (US2 e2e) is independent of T003 (US1 e2e) — both are separate test files,
  though they live in the same spec file and must be written to coexist.

---

## Notes

- The canvas fill is a pure `min-height` stretch — never change theme values or
  the `--crepe-color-background` source (spec-016 FR-005).
- `--mm-view-source` must be defined once in `:root` and not overridden per
  `data-theme` (single curated colour, FR-005/006).
- The view-source behaviour, tooltip, and keyboard shortcut are unchanged
  (spec-014 FR-007); only the glyph and its colour change.
