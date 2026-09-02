# Implementation Plan: Search Box for Visual Editing

**Branch**: `spec-055-visual-editor-search` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-visual-editor-search/spec.md`

## Summary

Add find-in-document to the visual (WYSIWYG) editing view: a docking search box with live literal case-insensitive matching, per-match highlight decorations, next/previous navigation with wrap-around, a "current of total" count, and clean dismissal. The implementation is renderer-only: a pure match-finding module plus a decoration plugin inside the existing editor host, driven by a small panel component, with the find command routed through the app's existing main-process shortcut mechanism. No new dependencies.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; Milkdown/Crepe (visual editor on ProseMirror; highlight decorations come from prosemirror-view, already a transitive dependency of the editor stack)

**Storage**: None. Search state lives only while the box is open and is never persisted.

**Testing**: Vitest (unit tests for the pure matcher) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: One linear scan of the document text per query keystroke while the box is open; imperceptible for 10,000-line documents; zero added work while the box is closed

**Constraints**: Renderer-only; no new dependencies; no new IPC channels (one shortcut entry reuses the existing command channel); search must never dispatch a document-changing edit

**Scale/Scope**: One pure domain module, one editor plugin, one panel component, shortcut wiring, unit + e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only. The one main-process addition is a shortcut entry that reuses the established menu command channel; no new IPC surface. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work. PASS
- **III. Never Lose The User's Words**: Highlights are decorations, not document edits; the plugin never dispatches a transaction that changes the document, so dirty tracking, saves, and undo are untouched by construction. Dismissal dispatches nothing. PASS
- **IV. Calm, Predictable Editing**: Match computation is one linear text scan per query change, only while the box is open; nothing is added to the keystroke path while the box is closed. Navigation scrolls the view without dialogs or focus stealing. PASS
- **V. Test What Can Corrupt Or Escape**: The failure mode that matters is a search that mutates content or drifts out of sync with edits. The pure matcher gets exact fixtures, and e2e asserts byte-identical content and an unchanged dirty state after a search and dismissal. PASS

## Project Structure

### Documentation (this feature)

```text
specs/055-visual-editor-search/
├── spec.md                 # WHAT and WHY (complete)
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: the feature adds no persisted entities, no IPC surface changes, and no install/run flow beyond the existing app.

### Source Code (repository root)

```text
src/renderer/
├── search/
│   ├── findMatches.ts        # NEW: pure matcher (query + per-block text → document positions)
│   ├── visualSearch.ts       # NEW: ProseMirror plugin (query state, highlight decorations, nav commands)
│   └── SearchPanel.tsx       # NEW: input, count, prev/next, close
├── editor/
│   └── CrepeHost.tsx         # Wire the plugin into the editor; expose open/nav/close to the panel
└── hooks/
    └── useMenuCommands.ts    # Route the find command to the active document's visual host
src/main/
├── shortcuts.ts              # Add the find shortcut (Ctrl/Cmd+F)
└── menuModel.ts              # Show the shortcut beside a Find entry
tests/
├── renderer/
│   └── search/
│       └── findMatches.test.ts   # Matcher fixtures
└── e2e/
    └── visual-search.spec.ts     # Spec scenarios against the built app
```

**Structure Decision**: The matcher is pure so every matching rule is unit-testable without a mounted editor, mirroring the existing domain/ + editor/ split (caretSync, cursorRestore). The plugin holds only ProseMirror plumbing; the panel holds only view state.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
