# Implementation Plan: Replace Source Editor

**Branch**: `phase-31-source-editor` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-replace-source-editor/spec.md`

## Summary

Replace the source-view textarea with a renderer-only CodeMirror 6 surface configured for Markdown and document-leading YAML frontmatter. Preserve the existing raw-source document, dirty-state, save, close, quit, external-change, source-to-visual, focus, and spellcheck flows; add independent source selection and scroll state. Add a persisted, default-on Markdown setting that controls visual-editor code token colors through CSS only, leaving document and editor state unchanged.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19.2, Node.js 22

**Primary Dependencies**: Electron 43, electron-vite 5, `@milkdown/crepe` 7.21, CodeMirror 6 state/view/language packages, Vitest 4, Playwright 1.62

**Storage**: Existing main-process JSON settings file; workspace Markdown files through existing atomic main-process writes

**Testing**: Vitest unit/component tests and Playwright Electron end-to-end tests

**Target Platform**: Windows, macOS, and Linux desktop Electron application

**Project Type**: Desktop application

**Performance Goals**: For documents up to 10,000 lines, source typing and updated highlighting complete within 100 ms for at least 95% of normal interactions without focus loss or interruption.

**Constraints**: Renderer remains sandboxed with no Node, filesystem, or Electron access; no new IPC/preload API or save behavior; raw source and trailing-newline state remain byte-exact; no source autocomplete, commands, or language-specific fenced-code highlighting; visual-code toggle cannot change content, selection, undo, or dirty state.

**Scale/Scope**: One editable source surface per open source-view tab, source context retained until the document closes, one persisted visual-editor presentation setting, and focused unit/e2e coverage for all acceptance scenarios.

## Constitution Check

### Pre-Research Gate

| Principle | Plan response | Status |
|-----------|---------------|--------|
| I. Process Isolation Is Absolute | Source highlighting runs entirely in the renderer. It uses no Node, filesystem, Electron module, IPC channel, or preload operation. | PASS |
| II. Every Path Is Untrusted | The feature does not add or alter path handling. Existing main-process file access remains unchanged. | PASS |
| III. Never Lose The User's Words | The existing raw-source update, dirty, atomic-save, and confirmation flows remain authoritative. Source context is per-document state; malformed input is never normalized to recover highlighting. | PASS |
| IV. Calm, Predictable Editing | CodeMirror incrementally highlights input, restores source selection and scroll per tab, and keeps focus handling scoped to the active source tab. The visual-code setting changes CSS paint only. | PASS |
| V. Test What Can Corrupt Or Escape | Unit tests cover source-context state and settings validation/persistence. Electron e2e tests cover raw save round trips, malformed input, tab context retention, confirmations, spellcheck, and visual-code toggle invariants. | PASS |
| Technology Constraints | Direct CodeMirror packages are declared runtime dependencies rather than imported transitively; Milkdown remains the visual editor. TypeScript stays strict. | PASS |

No constitutional deviations require Complexity Tracking.

### Post-Design Gate

The Phase 1 design keeps all filesystem and save behavior intact, exposes no new process boundary, and uses source-only state plus CSS presentation changes. The planned automated coverage exercises data-loss-sensitive raw-source paths and user-visible editor workflows. **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/031-replace-source-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── source-editor.md
│   └── visual-code-highlighting.md
└── tasks.md                 # Created by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── ipc-contract.ts                    # Existing Settings contract
├── main/
│   ├── settings.ts
│   └── settingsFile.ts                    # Existing validation and atomic persistence
├── preload/
│   └── index.ts                           # Existing named settings operations only
└── renderer/
    ├── App.tsx                            # Root visual-code presentation attribute
    ├── chrome/SettingsDialog.tsx          # Markdown settings control
    ├── editor/
    │   ├── SourceView.tsx                 # CodeMirror source wrapper
    │   ├── EditorPanel.tsx                # Source context wiring
    │   ├── CrepeHost.tsx                  # Initial visual code language configuration
    │   └── editor.css                     # Source and visual-code presentation styles
    ├── hooks/useSettingsState.ts          # Immediate settings persistence
    └── state/documents.ts                 # Source selection and scroll state

tests/
├── main/                                  # Settings validation and persistence tests
├── renderer/                              # Document reducer and settings hook tests
└── e2e/
    ├── source.spec.ts                     # Source editor workflows
    └── visual-code-highlighting.spec.ts   # Visual-code setting workflow
```

**Structure Decision**: Extend the current Electron main/preload/renderer split. Source editor behavior and source context belong in the renderer's editor and document-state modules. The existing settings contract and persistence path carry the one new persisted boolean; no process-boundary interface is added.

## Complexity Tracking

No constitutional violations or exceptional complexity are planned.
