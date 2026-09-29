# Implementation Plan: Find and Replace in the Editor

**Branch**: `spec-061-editor-find-replace` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/061-editor-find-replace/spec.md`

## Summary

Add plain, literal, case-insensitive replace to the find boxes that specs 055 (visual) and 056 (source) already provide. The shared `SearchPanel` gains a replace toggle that reveals a replacement input, a replace-current control, and a replace-all control. Both editing surfaces gain the same three operations through their existing imperative search handles: the visual view dispatches one ProseMirror transaction per action (built with the marks at the match start, so inserted text takes the formatting of the first matched character), and the source view dispatches one CodeMirror change set per action. Replace-all resolves overlapping candidates by the deterministic left-to-right non-overlapping policy that find already implies. Each action is a single undo step and a single dirty transition; the search box resets when it closes, switches tabs, or switches view. The source view gains the CodeMirror history extension it needs for the undo guarantee in source editing.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; Milkdown/Crepe (ProseMirror, whose history plugin is already included by Crepe, via `@milkdown/kit/prose/history`); CodeMirror (`@codemirror/state`, `@codemirror/view`) and `@codemirror/commands` for source undo history; `@codemirror/search` for source matching

**Storage**: None. Query and replacement live only while the box is open and are never persisted.

**Testing**: Vitest (unit tests for the pure matcher and the non-overlapping policy, and for the source search module against a real `EditorView`) plus Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: Replace-all is one document transformation over the matches already computed for the open query; imperceptible for 10,000-line documents, with no added work while the box is closed

**Constraints**: Renderer-only; one new direct dependency (`@codemirror/commands`, already present transitively); no new IPC channels (the new replace command reuses the existing `menu:command` route); no new preload surface

**Scale/Scope**: Two search modules extended, one shared panel component extended, one shortcut entry, unit + e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only. The one main-process addition is a shortcut entry that reuses the established menu command route; the shared command union gains one named command and no new channel. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work. PASS
- **III. Never Lose The User's Words**: Replace is an ordinary document edit: it marks the document dirty, is undoable as one step, and never runs without matches. An empty replacement deletes only the matched range. Undo restores the exact pre-action content, and a failed save still leaves the tab dirty. PASS
- **IV. Calm, Predictable Editing**: Replacement work happens only on an explicit action while the box is open; no added work on the keystroke path while the box is closed. The replacement input lives in the existing docking panel, not a modal. PASS
- **V. Test What Can Corrupt Or Escape**: The failure mode that matters is a replace that touches the wrong occurrences, mutates another document, or cannot be undone. The pure matcher and the non-overlapping policy get exact fixtures; source replace is unit-tested against a real editor state; e2e asserts exact content, dirty state, single-step undo, view scoping, and that other tabs are untouched. PASS

## Project Structure

### Documentation (this feature)

```text
specs/061-editor-find-replace/
├── spec.md                 # WHAT and WHY (complete)
├── plan.md                 # This file
├── research.md             # Phase 0 output
├── tasks.md                # Phase 2 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: the feature adds no persisted entities, no IPC surface changes, and no install/run flow beyond the existing app.

### Source Code (repository root)

```text
src/renderer/
├── search/
│   ├── findMatches.ts        # nonOverlapping(): the deterministic replace-all policy
│   ├── visualSearch.ts       # replacement + replaceOpen state, replaceCurrent, replaceAll
│   ├── sourceSearch.ts       # replacement + replaceOpen state, replaceCurrent, replaceAll
│   ├── useVisualSearch.ts    # expose replace state and actions to the panel
│   ├── SearchPanel.tsx       # replace toggle, replacement input, replace, replace all
│   └── search.css            # two-row panel layout
├── editor/
│   ├── CrepeHost.tsx         # handle.open(replace), setReplacement, replaceCurrent, replaceAll
│   ├── SourceView.tsx        # wire replace actions; add CodeMirror history
│   └── EditorPanel.tsx       # pass the new SearchPanel props
├── hooks/
│   └── useMenuCommands.ts    # route the replace command (Ctrl/Cmd+H) to the active document
├── chrome/
│   └── menuModel.ts          # hamburger Replace… entry and accelerator
└── App.tsx                   # find request carries the replace flag
src/main/
└── shortcuts.ts              # Ctrl/Cmd+H → replace
src/shared/
└── ipc-contract.ts           # MenuCommand gains 'replace'
tests/
├── renderer/search/
│   ├── findMatches.test.ts   # nonOverlapping fixtures
│   └── sourceSearch.test.ts  # replace-current, replace-all, undo isolation, view scope
├── renderer/menuModel.test.ts
├── main/shortcuts.test.ts
└── e2e/find-replace.spec.ts  # spec scenarios against the built app
```

**Structure Decision**: The deterministic policy lives as a pure function next to the matcher so it is unit-testable without a mounted editor. Each editing surface keeps its own replace implementation because the two document models differ (ProseMirror marks and transactions vs CodeMirror change sets and annotations); the shared piece is the panel and the command routing, exactly as find is shared today.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
