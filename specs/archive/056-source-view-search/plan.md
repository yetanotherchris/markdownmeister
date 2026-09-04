# Implementation Plan: Search Box for Source Editing

**Branch**: `spec-056-source-view-search` (per-spec implementation branch; all four specs of this batch are specified together on branch `specs-055-058-search-and-new-file`, PR #99) | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-source-view-search/spec.md`

## Summary

Add find-in-document to the source view: the same search box experience as the visual view (live literal case-insensitive matching, highlights, wrap-around navigation, "current of total" count, clean dismissal), plus caret placement on the current match. The source editor's own ecosystem provides a maintained search package; the app drives it programmatically from its own panel so both views share one look and one interaction model. One new dependency, justified below; no IPC changes beyond the shared find shortcut from spec 055.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; CodeMirror 6 (source view: `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`); NEW `@codemirror/search` 6.7.x (registry-verified, MIT, the CodeMirror family's own search package); shared `SearchPanel` component from spec 055

**Storage**: None. Search state lives only while the box is open and is never persisted.

**Testing**: Vitest (unit tests for the glue module) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: One linear text scan per query keystroke while the box is open, via the search package; imperceptible for 10,000-line documents

**Constraints**: Renderer-only; selection-only transactions during search (dirty state must never flip); the package's default search panel UI is not used; the package's default keymap must not be registered (the shortcut comes from the main process command route)

**Scale/Scope**: One glue module, panel wiring in the source view, command routing, unit + e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only; the shortcut reuses the existing command channel added in spec 055. The one new dependency is a renderer npm package, not a process boundary change. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work. PASS
- **III. Never Lose The User's Words**: Search dispatches selection-only transactions; the glue module's tests assert the dirty state cannot flip during search or navigation. Unsaved edits are preserved by construction; dismissal changes nothing but selection and highlights. PASS
- **IV. Calm, Predictable Editing**: The search package scans linearly per query change, only while the box is open; navigation scrolls without dialogs; the word wrap setting is untouched. PASS
- **V. Test What Can Corrupt Or Escape**: The risky parts are accidental document mutation and caret drift; unit tests cover the glue (query building, wrap counting, no-match handling) and e2e asserts content, dirty state, and caret placement exactly. PASS

## Project Structure

### Documentation (this feature)

```text
specs/056-source-view-search/
├── spec.md                 # WHAT and WHY (complete)
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: no persisted entities, no IPC surface changes, no install/run flow beyond the existing app.

### Source Code (repository root)

```text
package.json                   # + @codemirror/search
src/renderer/
├── search/
│   ├── SearchPanel.tsx        # Shared with 055 (extracted there); reused, not duplicated
│   └── sourceSearch.ts        # NEW: glue between the panel and the search package (query, counts, nav, open/close)
├── editor/
│   └── SourceView.tsx         # Register the search extension; mount the panel in the source view area
└── hooks/
    └── useMenuCommands.ts     # Route the find command to the source host when the source view is active
tests/
├── renderer/
│   └── search/
│       └── sourceSearch.test.ts
└── e2e/
    └── source-search.spec.ts
```

**Structure Decision**: The panel is shared with spec 055 so both views present identical search UI; only the glue module is source-specific, keeping CodeMirror specifics out of the shared component. Implementation order assumes 055 lands first; if 056 lands first, extracting the shared panel is part of this spec's work.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
