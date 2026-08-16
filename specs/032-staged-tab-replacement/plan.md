# Implementation Plan: Staged Same-Tab Replacement

**Branch**: `phase-32-staged-replacement` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

## Summary

Stage an incoming Milkdown editor invisibly while retaining the outgoing clean editor, then commit the replacement only after the staged editor is ready and the outgoing document remains live-clean. This prevents the visible empty-editor interval without changing filesystem, IPC, preload, or save behavior.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19.2, Electron 43

**Primary Dependencies**: `@milkdown/crepe`, React, Vitest, Playwright

**Storage**: Existing in-memory document session and main-process Markdown file persistence

**Testing**: Vitest reducer tests and Playwright Electron end-to-end tests

**Target Platform**: Desktop Electron application

**Project Type**: Desktop application

**Performance Goals**: No empty or unusable editor canvas during same-tab replacement; outgoing editor stays visible until incoming initialization completes.

**Constraints**: Preserve raw-source authority, live dirty checks, unsaved-change confirmation, editor-pool bounds, process isolation, and existing open/new-tab behavior. No new IPC or filesystem access.

**Scale/Scope**: One staged incoming editor per outgoing tab; a replacement is cancelled when superseded, closed, or dirtied.

## Constitution Check

| Principle | Plan response | Status |
|-----------|---------------|--------|
| Process Isolation | All staging runs in the renderer using existing editor state. No IPC or preload changes. | PASS |
| Every Path Is Untrusted | No path behavior changes. | PASS |
| Never Lose The User's Words | Commit re-checks live dirty state; a dirty outgoing document cancels staging. | PASS |
| Calm, Predictable Editing | Outgoing editor remains visible and interactive; staged editor is hidden and inert. | PASS |
| Test What Can Corrupt Or Escape | Reducer and Electron tests cover commit, cancellation, source edits, close, and visible-surface continuity. | PASS |

## Project Structure

```text
src/renderer/
├── state/documents.ts             # Staged replacement state and transitions
├── hooks/useDocumentSession.ts    # Prepare, commit, and cancel orchestration
├── hooks/useEditorPool.ts         # Temporary staged editor pool safety
├── App.tsx                        # Stable panel identity and staged-document wiring
└── editor/
    ├── EditorPanel.tsx            # Visible outgoing and hidden incoming hosts
    ├── CrepeHost.tsx              # Ready notification after initialization
    └── editor.css                 # Inert layoutable staging layer

tests/
├── renderer/documents.open-replace.test.ts
└── e2e/open-in-current-tab.spec.ts
```

## Design Decisions

- Give each visual panel a stable identity distinct from a document id so React can retain the outgoing host while mounting the staged incoming host.
- Store at most one pending replacement per panel. A new request cancels the prior pending editor before staging another.
- Keep the staged host layoutable but invisible and inert; `display: none` is excluded because editor initialization requires layout.
- Re-check `isDirtyLive` immediately before commit rather than trusting the debounced store flag.
- Allow a temporary extra pool member during staging, then release outgoing or incoming editor immediately on commit or cancellation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Temporary editor above normal pool cap | Both outgoing and incoming editors must coexist to prevent the empty-canvas transition. | Destroying the outgoing editor first recreates the one-second blank state. |
