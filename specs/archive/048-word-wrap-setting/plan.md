# Implementation Plan: Source View Word Wrap Setting

**Branch**: `spec-048-word-wrap-setting` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/048-word-wrap-setting/spec.md`

## Summary

A new boolean preference, word wrap, joins the Markdown settings area as an immediate-commit switch governing the source view's line presentation. The source editor holds its wrapping extension in a compartment so toggling the setting reconfigures open editors in place, preserving text, selection, scroll context, and dirty state. Default is off, matching today's behaviour exactly; the value travels the existing settings pipeline with trusted-process validation and no new channels.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (shared contract, main validation, React renderer)

**Primary Dependencies**: None new beyond the editor framework's own public compartment API.

**Storage**: One new key in the config file's settings object; debounced atomic write unchanged.

**Testing**: Vitest unit tests (hook state/cache/IPC, validation recovery); Playwright e2e for immediate effect (overflow measurement), mid-edit safety (selection/dirty preservation), multi-tab application, restart persistence with config polling, typing-latency smoke on a large document.

**Target Platform**: All desktop platforms.

**Performance Goals**: SC-005: imperceptible typing latency with wrap enabled at 10,000 lines; measured, not assumed (research R4).

**Constraints**: FR-002 requires byte-for-byte behavioural identity when off; FR-005 forbids any editing-state disturbance on toggle; constitution I fixed preload surface.

**Scale/Scope**: ~9 small edits plus one new e2e spec; one production component touched beyond settings plumbing (SourceView).

## Constitution Check

*GATE: renderer feature behind existing settings infrastructure.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Honoured - no new operations; patch validated in main via the existing strict boolean check |
| II. Every Path Is Untrusted | None - no paths involved |
| III. Never Lose The User's Words | Honoured - FR-005 and the mid-edit e2e scenarios pin text/dirty preservation across toggles; persistence writes untouched |
| IV. Calm, Predictable Editing | Direct target - immediate quiet effect, preserved caret/selection context; latency verification at the principle's threshold |
| V. Test What Can Corrupt Or Escape | Honoured - editing-state preservation and malformed-config recovery are the corruption-shaped risks here and are unit/e2e covered |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/048-word-wrap-setting/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
└── research.md    # R1-R4 with evidence
```

### Source Code (repository root)

```text
src/shared/ipc-contract.ts             # EDIT: wordWrap on Settings
src/main/settingsFile.ts               # EDIT: DEFAULTS, validateSettings, mergeSettingsPatch, boolean patch check, migration keys
src/renderer/state/settings.ts         # EDIT: renderer default
src/renderer/hooks/useSettingsState.ts # EDIT: state + handler
src/renderer/App.tsx                   # EDIT: pass prop chain to editor surfaces
src/renderer/editor/EditorPanel.tsx    # EDIT: forward to SourceView
src/renderer/editor/SourceView.tsx     # EDIT: compartment-held lineWrapping + reactive effect
src/renderer/chrome/SettingsDialog.tsx # EDIT: props + Markdown-area switch row
tests/main/settings.test.ts            # EDIT: malformed-value recovery case
tests/renderer/useSettingsState.test.tsx # EDIT: handler updates cache + IPC
tests/renderer/settingsAbout.test.tsx  # EDIT: baseProps gains two props
tests/e2e/word-wrap.spec.ts            # NEW: acceptance scenarios incl. latency smoke
package.json                           # EDIT: append touched files to scripts.format:check
```

**Structure Decision**: Settings plumbing mirrors spec 045's template exactly; the only novel production code is the compartment inside SourceView, kept beside the construction effect it extends.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Compartment reconfiguration**: the wrapping extension lives in a compartment created alongside the existing extensions (`SourceView.tsx:65-83`); a prop-change effect reconfigures it, mirroring the spellcheck effect pattern (:96-100). Preserves all editing state; satisfies FR-004/FR-005.
- **D2 Default off**: zero hits for line wrapping today (research R1), so off is behaviourally identical to the current build, satisfying FR-002 by construction.
- **D3 Field name `wordWrap`**: positive phrasing; absent/malformed values mean off, matching FR-006 semantics through the shared tolerant-load path.
- **D4 Immediate-commit switch**: consistent with every Markdown-area neighbour.
- **D5 Latency as a tested gate**: an e2e smoke types into a large wrapped document and asserts responsiveness rather than relying on virtualisation theory alone (SC-005, research R4).

## Complexity Tracking

> No constitution violations. Rejected alternatives (CSS overrides, editor rebuild) recorded in research R2 with reasons.
