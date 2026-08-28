# Implementation Plan: Settings Dialog Fixes

**Branch**: `spec-050-settings-dialog-fixes` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/050-settings-dialog-fixes/spec.md`

## Summary

Three small, independent UI corrections. The About area drops the "Version" label and the entire Revision row, keeping only the bare version value and the unchanged repository link. The editor theme dropdown loses its visible "Theme" label and its right-aligned label-row position, starting at the section's left content edge with an `aria-label` preserving its programmatic name. The word wrap switch leaves the Settings dialog's Markdown area and reappears as an `aria-pressed` toggle button at the far right of the source view's header bar, wired to the same persisted preference through the same handler chain, so storage, validation, and the CodeMirror compartment behaviour are untouched.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (React renderer only)

**Primary Dependencies**: None new.

**Storage**: None changed. The word wrap preference keeps its existing key, default (off), tolerant load, and validation in the main process; only the surface that toggles it moves.

**Testing**: Vitest unit tests (About area, settings state props); Playwright e2e against the real built app (About content, dropdown alignment and accessible name, source view toggle behaviour migrated from the settings-control suite).

**Target Platform**: All desktop platforms.

**Performance Goals**: None beyond status quo; toggling wrap already reconfigures CodeMirror through a compartment with no editor rebuild.

**Constraints**: FR-007 and FR-015 demand byte-for-byte behavioural identity for everything not named; the theme select must keep its accessible name (FR-006); the toggle must preserve text, selection, dirty state, and typing position (FR-013).

**Scale/Scope**: Five production files edited, no new files; three e2e suites updated, one unit suite updated.

## Constitution Check

*GATE: renderer-only presentation change behind existing settings infrastructure.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Honoured - no IPC, preload, or main-process changes; the toggle reuses the existing `updateSettings({ wordWrap })` operation |
| II. Every Path Is Untrusted | None - no paths involved |
| III. Never Lose The User's Words | Honoured - the toggle path cannot touch document text (compartment reconfigure only); existing mid-edit e2e scenarios are kept and re-pointed at the new control |
| IV. Calm, Predictable Editing | Honoured - the toggle sits on the surface it affects, applies immediately and quietly, no dialogs or focus theft |
| V. Test What Can Corrupt Or Escape | Honoured - editing-state preservation and malformed-preference recovery remain covered; coverage migrates with the control |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/050-settings-dialog-fixes/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
├── research.md    # R1-R4 with evidence
└── tasks.md       # Ordered work items
```

### Source Code (repository root)

```text
src/renderer/chrome/AboutArea.tsx        # EDIT: drop Version label, drop Revision row + copy handler
src/renderer/chrome/SettingsDialog.tsx   # EDIT: theme select without visible label + aria-label; remove word wrap switch and its props
src/renderer/chrome/settings.css         # EDIT: standalone select style; remove unused .settings-about-copy
src/renderer/editor/SourceView.tsx       # EDIT: aria-pressed Word Wrap toggle at far right of the header bar
src/renderer/editor/EditorPanel.tsx      # EDIT: forward onWordWrapChange to SourceView
src/renderer/App.tsx                     # EDIT: stop passing wordWrap props to SettingsDialog; pass handler into the editor chain
tests/renderer/settingsAbout.test.tsx    # EDIT: About, theme dropdown, and Markdown-area assertions
tests/renderer/useSettingsState.test.tsx # EDIT: dialog props no longer include word wrap
tests/e2e/about.spec.ts                  # EDIT: two rows, no revision content anywhere
tests/e2e/word-wrap.spec.ts              # EDIT: toggle via the source view header bar; settings-absence and state-visibility scenarios
tests/e2e/editor-theme.spec.ts           # EDIT: left-edge alignment + accessible name without visible label
tests/e2e/json-editor-themes.spec.ts     # EDIT: combobox lookups if they relied on the visible label
tests/e2e/settings.spec.ts               # EDIT: word wrap and theme-row assertions
package.json                             # EDIT: append touched files to scripts.format:check if missing
```

**Structure Decision**: No new components. The toggle is a button inside SourceView's existing toolbar, styled after the neighbouring back button; everything else is deletion or relabelling inside existing components.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 About is a UI-only removal**: the BuildInfo IPC shape and `getBuildInfo` stay intact; only the panel's presentation changes. The contract still serves version and repository URL, and stripping the field would churn the preload surface against the constitution's fixed-API stance for no user-visible gain.
- **D2 Accessible name via `aria-label="Theme"`**: the visible label is removed but the programmatic name the existing e2e suite asserts (`getByRole('combobox', { name: 'Theme' })`) is retained, satisfying FR-006 without touching any other suite's expectations.
- **D3 Select rendered bare with a standalone class**: the spellcheck language row shares `.settings-select-label`, so that class cannot be repurposed; the theme select gets its own left-aligned class reusing the same select box styling.
- **D4 Toggle as `aria-pressed` button**: matches the header bar's existing button style, communicates state visibly (pressed styling) and to assistive technology (FR-010), and threads `onWordWrapChange` down the existing App -> EditorPanel -> SourceView prop chain to the unchanged `handleWordWrapChange` in `useSettingsState`.
- **D5 `margin-left: auto` for the far-right position**: the toolbar is already a flex row; the back button stays at the far left as its first child and the toggle becomes the last, satisfying FR-009 without layout restructuring.

## Complexity Tracking

> No constitution violations. Rejected alternatives (removing `revision` from the BuildInfo contract, reusing `.settings-select-label` with a modifier, a CSS-only toggle widget) recorded in research R1-R3 with reasons.
