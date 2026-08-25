# Implementation Plan: Formatting Bar Visibility Setting

**Branch**: `spec-045-formatting-bar-visibility` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/045-formatting-bar-visibility/spec.md`

## Summary

A new boolean preference, formatting bar visibility, joins the Markdown settings area as an immediate-commit switch. It travels the existing settings pipeline into the renderer, where it is exposed as a data attribute on the application root and consumed by one CSS rule that removes the visual editor's top bar from layout and interaction entirely. Default is visible; malformed stored values fall back to visible through the existing tolerant load path. No new privileged operations: the value rides the established settings-update channel.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (shared contract, main-process validation, React renderer)

**Primary Dependencies**: None new. Settings IPC surface unchanged (fixed preload list); styling via the existing editor stylesheet.

**Storage**: One new key inside the `settings` object of the existing config file; debounced atomic write and legacy-migration handling already in place.

**Testing**: Vitest unit tests (hook state/cache/IPC patch, main-process validation recovery, dialog prop contract), Playwright e2e for toggle immediacy, zero reserved height, focus safety, restart persistence, and adversarial config.

**Target Platform**: Windows/macOS/Linux desktop, identical behaviour.

**Performance Goals**: N/A beyond normal settings interactions; no keystroke-path impact.

**Constraints**: Constitution I (no new channels; validation in main), IV (immediate quiet effect, no dialogs), FR-003 requires true layout removal rather than visual suppression.

**Scale/Scope**: ~9 small edits across shared/main/renderer plus one new e2e spec; no architectural change.

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Honoured - reuses `settings:update`; no new channels or escape hatches; patch validated by the trusted process before persistence |
| II. Every Path Is Untrusted | None - no filesystem paths involved |
| III. Never Lose The User's Words | None - presentation-only; documents and dirty state untouched |
| IV. Calm, Predictable Editing | Honoured - immediate effect without restarts; hiding never steals focus (edge case handled); default preserves today's appearance |
| V. Test What Can Corrupt Or Escape | Honoured in proportion - validation-rejection and recovery unit tests plus user-visible e2e scenarios |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/045-formatting-bar-visibility/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
└── research.md    # R1-R4 decisions with evidence
```

### Source Code (repository root)

```text
src/shared/ipc-contract.ts            # EDIT: formattingBarVisible on Settings
src/main/settingsFile.ts              # EDIT: DEFAULTS, validateSettings, mergeSettingsPatch, boolean patch check, migration keys
src/main/ipc/handlers/settings.ts     # EDIT (verify only): nothing needed if validation covers the new key
src/renderer/state/settings.ts        # EDIT: renderer-side default
src/renderer/hooks/useSettingsState.ts # EDIT: state + handler
src/renderer/App.tsx                  # EDIT: wire hook to dialog + set data-formatting-bar on root
src/renderer/editor/editor.css        # EDIT: display:none rule under [data-formatting-bar='off']
src/renderer/chrome/SettingsDialog.tsx # EDIT: props + Markdown-area switch row
tests/main/settings.test.ts           # EDIT: malformed-value recovery case
tests/renderer/useSettingsState.test.tsx # EDIT: handler updates cache + IPC
tests/renderer/settingsAbout.test.tsx  # EDIT: baseProps gains the two new props
tests/e2e/formatting-bar-visibility.spec.ts # NEW: acceptance scenarios
package.json                          # EDIT: append touched files to scripts.format:check
```

**Structure Decision**: Follows the established boolean-setting template end to end (`visualCodeHighlighting` is the named precedent at every layer).

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Attribute + CSS application**: `data-formatting-bar="on|off"` on `.app-container`, with `.app-container[data-formatting-bar='off'] .milkdown-top-bar { display: none }`. Satisfies FR-002 (all surfaces at once) and FR-003 (layout collapse) without touching long-lived editor instances.
- **D2 No feature reconfiguration**: Crepe features are construction-fixed and editors outlive dialog toggles; recreating them would lose undo history. Rejected (research R1).
- **D3 Immediate-commit control**: a standard Markdown-area switch committing on click, consistent with every neighbour and with FR-002.
- **D4 Field name and default**: `formattingBarVisible: true`, positive phrasing so absent/malformed values mean "visible", matching FR-005/FR-006 semantics.

## Complexity Tracking

> No constitution violations. Nothing here departs from fixed stack decisions; the only noteworthy choice is D1's application mechanism, justified against two rejected alternatives in research R1.
