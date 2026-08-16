# Tasks: Replace Source Editor

**Input**: Design documents from `/specs/031-replace-source-editor/`

## Phase 1: Source Editor Foundation

- [x] T001 Declare direct CodeMirror runtime dependencies in `package.json` and lockfile.
- [x] T002 Add source selection and scroll fields plus a pure capture action to `src/renderer/state/documents.ts`.
- [x] T003 Replace the textarea implementation in `src/renderer/editor/SourceView.tsx` with a renderer-only CodeMirror Markdown/YAML editor that preserves the accessible contract, spellcheck, focus, raw change callback, and source context callback.
- [x] T004 Wire document-local source context through `src/renderer/editor/EditorPanel.tsx` and the document-session action dispatch.
- [x] T005 Update source editor styling in `src/renderer/editor/editor.css` without changing source toolbar behavior.

## Phase 2: Visual Code Highlighting Setting

- [x] T006 Add the default-on `visualCodeHighlighting` field to the shared settings contract, renderer defaults, main defaults, tolerant disk validation, strict IPC patch validation, merge, and legacy migration key list.
- [x] T007 Add the Markdown settings control and immediate persisted state handler without calling the Markdown parser reconfiguration path.
- [x] T008 Configure visual-editor code-block language support at Crepe construction and use a root presentation data attribute with scoped CSS to neutralize visual code tokens when disabled.

## Phase 3: Tests

- [x] T009 Add Vitest coverage for source context transitions and visual-code settings validation/persistence.
- [x] T010 Extend Electron Playwright source workflows for Markdown/YAML decoration, raw save fidelity, malformed input, selection/scroll tab restoration, focus, spellcheck, and dirty confirmations.
- [x] T011 Add Electron Playwright coverage for default visual code highlighting, presentation-only toggle invariants, source-view immunity, and restart persistence.

## Phase 4: Validation

- [x] T012 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`.
