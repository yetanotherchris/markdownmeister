# Implementation Plan: New Explorer File Opens in a Tab

**Branch**: `spec-058-new-file-opens-tab` (per-spec implementation branch; all four specs of this batch are specified together on branch `specs-055-058-search-and-new-file`, PR #99) | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/058-new-file-opens-tab/spec.md`

## Summary

When a new file created from the explorer's New File action gets its name confirmed, open that file in a new active tab, reusing the existing open path so duplicate-tab prevention and open machinery apply unchanged. Cancellation and failed naming open nothing; folders never open tabs; no other open path changes. Renderer-only change in the workspace tree hook; no IPC changes.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; the app's existing document-open and workspace-tree hooks (no new libraries)

**Storage**: None. No persistence, settings, or stored entities are added.

**Testing**: Vitest (hook-level tests for the creation flow) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: The open happens once per confirmed creation; no added work on any keystroke path

**Constraints**: Renderer-only; no new IPC channels; the open must reuse the existing validated open path (no direct filesystem access); the open-behaviour setting is not consulted for this flow (new tab is forced)

**Scale/Scope**: One hook change, unit tests, updates to one existing e2e expectation plus new e2e scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: The open rides the existing IPC open path (`entry` read/open channels already validated in the main process); no new channel, no renderer filesystem access. PASS
- **II. Every Path Is Untrusted**: The path opened is the one the main process itself created and renamed; containment was validated at creation and rename time by the existing handlers. PASS
- **III. Never Lose The User's Words**: Forcing a new tab means a creation can never replace or displace an active document, dirty or not; duplicate prevention is reused rather than reimplemented; cancellation keeps the existing discard behaviour. PASS
- **IV. Calm, Predictable Editing**: One predictable outcome per confirmed creation; no dialogs; the new tab is active so the result is visible, not silent. PASS
- **V. Test What Can Corrupt Or Escape**: The risky cases are the dirty-tab displacement and the duplicate tab; both have dedicated unit and e2e coverage. PASS

## Project Structure

### Documentation (this feature)

```text
specs/058-new-file-opens-tab/
├── spec.md                 # WHAT and WHY (complete)
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: no persisted entities, no IPC surface changes, no install/run flow beyond the existing app.

### Source Code (repository root)

```text
src/renderer/
└── hooks/
    └── useWorkspaceTree.ts   # Track the creation placeholder; on confirmed commit, open the final path in a new tab
tests/
├── renderer/                 # Extend the existing hook-level create/rename/cancel test suite
└── e2e/
    ├── organize.spec.ts      # Update the creation scenario: the new tab is now expected
    └── new-file-tab.spec.ts  # NEW: dirty-tab safety, cancellation, folder creation, duplicate focus
```

**Structure Decision**: The whole change sits in the workspace tree hook, where creation, commit, and cancellation already live; no new module is warranted for a two-step wire-up between an existing creation flow and an existing open flow.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
