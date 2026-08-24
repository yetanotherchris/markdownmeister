# Research: Source View Word Wrap Setting

Date: 2026-08-24. Every claim verified against this worktree during planning.

## R1 - Current wrapping state: none, anywhere

**Decision**: Default the preference to off; it reproduces today's presentation exactly.

**Evidence**: A repository-wide search for `lineWrapping` across `src/` and `tests/` returns zero hits. The source view constructs its editor once with a fixed extension list (`SourceView.tsx:65-83` inside a mount-only effect ending :94), so no wrap behaviour exists and long lines overflow with horizontal scrolling today.

## R2 - Reactive application: compartment reconfiguration

**Decision**: Hold the line-wrapping extension in an editor compartment and reconfigure it when the setting changes; do not rebuild the editor.

**Evidence**: Extensions are frozen at construction (mount-only effect, `SourceView.tsx:62-94`), so a prop change cannot alter the extension list directly. The in-file reactive precedent mutates DOM properties on prop change (`view.contentDOM.spellcheck = spellcheckEnabled`, :96-100), which cannot add or remove an extension. Compartments exist for exactly this reconfiguration need and preserve document text, selection, scroll, and undo state across the swap, satisfying FR-004 and FR-005. Editor surfaces are per-document and pooled; rebuilding to change wrapping would discard source-view context that the app deliberately persists (`documents.ts:38-40, 392-410`).

**Alternatives considered**:

- *CSS white-space overrides on the content element* - fights the editor's own measurement of line geometry (gutters, coordinates), risking caret/selection misalignment. Rejected.
- *Recreate the editor on toggle* - loses persisted selection/scroll context per tab and costs a full parse. Rejected.

## R3 - Settings plumbing: identical shape to spec 045's boolean

**Decision**: Add `wordWrap: boolean` (default `false`) through the same chain: shared contract field, main-process defaults/validation/merge/migration keys, renderer-side default, hook handler, App wiring, Markdown-area switch row.

**Evidence**: Touch-point map established for the settings system (`src/shared/ipc-contract.ts:145-172`; `settingsFile.ts:8-18, 43-88, 90-131, 150-158, 178-193`; `state/settings.ts:4-14`; `useSettingsState.ts:133-139`; dialog switch template `SettingsDialog.tsx:254-264`). No new channel: the patch rides settings:update, keeping the preload surface fixed. Absent keys fall back to defaults during tolerant load (`tests/main/settings.test.ts:860-874` precedent), covering upgrades.

## R4 - Performance expectation for wrap on large documents

**Decision**: Treat wrapping cost as bounded by the editor's viewport virtualisation, but verify typing latency at the principle's threshold rather than assert it from theory.

**Evidence**: The editor renders only the visible portion of large documents (its design virtualises off-screen content), so enabling wrapping affects measurement of visible lines, not whole-document layout. Constitution IV requires imperceptible latency up to 10,000 lines; SC-005 turns this into a tested check instead of an assumption. No benchmark exists today either way; the plan records the verification honestly as work to perform.

## References

- Source view construction and reactive precedent: `src/renderer/editor/SourceView.tsx:58-100`
- Persisted source-view context: `src/renderer/state/documents.ts:38-40, 392-410`
- Settings chain: same map as research R3
- Line wrapping extension: CodeMirror reference documentation (https://codemirror.net/docs/ref/#view.EditorView^lineWrapping) and Compartment (https://codemirror.net/docs/ref/#state.Compartment)
