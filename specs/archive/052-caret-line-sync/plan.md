# Implementation Plan: Caret Line Sync Between Editing Views

**Branch**: `spec-052-caret-line-sync` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-caret-line-sync/spec.md`

## Summary

Sync the two carets at view-switch time, to line accuracy. The switch already produces the exact source text the source view will display; at that moment we derive a block-to-line table (which lines of the displayed text belong to which top-level content block), map the origin caret through it, and seed the destination caret with the result. The per-surface stored contexts stay exactly as they are today and remain the fallback whenever the mapping cannot produce a confident answer, and the sole behavioural override (mapped restore on the way back) is the one FR-004 describes.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; Milkdown/Crepe (visual editor, ProseMirror data model); CodeMirror 6 (source view); remark/micromark pipeline (already used for parsing and serialisation)

**Storage**: In-memory per-tab caret contexts in the documents reducer; nothing persisted, no new files or settings

**Testing**: Vitest (unit, mapping module) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: Switch latency stays imperceptible for 10,000-line documents; one extra linear parse at switch time, nothing on the keystroke path

**Constraints**: Renderer-only change; no new IPC channels; no change to saved bytes, dirty tracking, or undo

**Scale/Scope**: One new pure domain module, small wiring at the two switch points, unit + e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only DOM/state work; no new channels, no preload changes. PASS
- **II. Every Path Is Untrusted**: No filesystem or path work involved. PASS
- **III. Never Lose The User's Words**: The feature only positions carets; content capture, dirty tracking, and save paths are untouched, and all mapping failures degrade to today's behaviour rather than altering content. PASS
- **IV. Calm, Predictable Editing**: Mapping work happens once per switch on text the switch already has in hand; no keystroke-path work; destinations reveal the caret so switching stays predictable. PASS
- **V. Test What Can Corrupt Or Escape**: The risky part of this feature is silent mis-mapping, so the unit suite targets the correspondence table and its clamp/fallback chains with exact fixtures. PASS

## Project Structure

### Documentation (this feature)

```text
specs/052-caret-line-sync/
├── spec.md                 # Complete ( WHAT and WHY )
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: the feature adds no persisted entities, no IPC surface, and no install/run flow beyond the existing app. The per-tab caret contexts are documented as Key Entities in the spec and in research R4.

### Source Code (repository root)

```text
src/renderer/
├── domain/
│   └── caretSync.ts        # NEW: pure mapping module (block table, clamps, correlation)
├── editor/
│   ├── SourceView.tsx      # Receives already-mapped selection values (signature unchanged)
│   ├── CrepeHost.tsx       # Unchanged
│   └── cursorRestore.ts    # Reused as-is for clamped visual-side application
├── hooks/
│   ├── useSourceViewToggle.ts  # Wiring: seed source context on enter; choose mapped vs stored on return
│   └── useDocumentSession.ts   # Wiring: mapped offsets flow through existing capture actions
└── state/
    └── documents.ts        # Two new optional fields on DocumentState (synced snapshot), no reducer-shape breaks

tests/
├── renderer/
│   └── caretSync.test.ts   # NEW: unit tests for the mapping module
└── e2e/
    └── caret-sync.spec.ts  # NEW: switch-time sync scenarios against the built app
```

**Structure Decision**: A pure domain module keeps every rule (block table, correlation, clamps) out of components and reducers, matching the existing domain/ layout (frontmatter, dirty, quit) and making the clamp chain unit-testable without an editor mounted.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
