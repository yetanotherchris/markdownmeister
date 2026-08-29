# Implementation Plan: View-Switching Caret Sync and Word Wrap Toggle Fixes

**Branch**: `spec-053-view-sync-fixes` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-view-sync-fixes/spec.md`

## Summary

Two renderer-only fixes to the view-switching surface. First, the spec 052 caret synchronisation fails silently for documents whose last content block is a list, table, code block, or quote: Milkdown keeps a trailing empty paragraph after such a block so the caret has a host, remark-parse does not produce it, the block-count check refuses the correlation, and the source view opens at the stored context (the top of the document). The fix reports whether the visual document's last top-level child is an empty paragraph, drops that one child when correlating, and lets the mapped restore on the return path accept the same trailing empty paragraph. Second, the Word Wrap toggle in the source toolbar renders grey when off, keeping the accent pressed state when on.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; Milkdown/Crepe (visual editor, ProseMirror data model); CodeMirror 6 (source view); remark/micromark pipeline (already used for parsing and serialisation)

**Storage**: In-memory per-tab caret contexts in the documents reducer; nothing persisted, no new files or settings

**Testing**: Vitest (unit, mapping module + geometry + restore plans) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: No change to switch latency; the trailing-paragraph check is a per-switch O(1) look at data the switch already reads

**Constraints**: Renderer-only change; no new IPC channels; no change to saved bytes, dirty tracking, undo, or stored contexts

**Scale/Scope**: Two small behavioural fixes: a lenient correlation in the existing mapping module, and a CSS rule for one toggle

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only DOM/state work and one CSS rule; no new channels, no preload changes. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work involved. PASS
- **III. Never Lose The User's Words**: The fixes only position carets and restyle a toggle; content capture, dirty tracking, and save paths are untouched, and every mapping failure degrades to today's behaviour. PASS
- **IV. Calm, Predictable Editing**: Mapping work happens once per switch on data the switch already reads; the word-wrap change is presentational. PASS
- **V. Test What Can Corrupt Or Escape**: The risky part is a silent mis-correlation (dropping a real block as if it were the artifact), so the unit suite pins the leniency to exactly a trailing empty paragraph and the e2e suite covers documents ending in each affected block type. PASS

## Project Structure

### Documentation (this feature)

```text
specs/053-view-sync-fixes/
├── spec.md                 # Complete ( WHAT and WHY )
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: the feature adds no persisted entities, no IPC surface, and no install/run flow. The trailing-empty-paragraph signal is documented as a Key Entity in the spec and detailed in research R4.

### Source Code (repository root)

```text
src/renderer/
├── domain/
│   └── caretSync.ts            # planSourceSeed: lenient correlation (trailingEmptyParagraph)
├── editor/
│   ├── instancePool.ts         # getSelectionGeometry: report trailing empty paragraph
│   ├── cursorRestore.ts        # planBlockRestore: accept a trailing empty paragraph
│   └── editor.css              # .source-word-wrap: grey off state, accent on (unchanged)
├── hooks/
│   └── useSourceViewToggle.ts  # pass geometry.trailingEmptyParagraph into planSourceSeed

tests/
├── renderer/
│   ├── domain/caretSync.test.ts        # NEW: lenient correlation unit cases
│   ├── cursorRestore.test.ts           # NEW: trailing-empty-paragraph restore cases
│   └── sourceViewToggleSync.test.tsx   # UPDATE: stub geometry + mapped entry with trailing block
└── e2e/
    ├── caret-sync.spec.ts              # NEW: trailing-block docs entry + return scenarios
    └── word-wrap.spec.ts               # UPDATE: grey off-state assertion
```

**Structure Decision**: The fixes extend the existing spec 052 modules in place. The trailing-empty-paragraph signal is computed where the geometry is already read (instancePool), consumed by the pure mapping module (caretSync), and the return path's count check is widened in the restore plan (cursorRestore). No new modules or abstractions are warranted for two one-line behavioural changes.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |