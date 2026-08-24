# Implementation Plan: Editor Theme Dropdown Selection

**Branch**: `spec-047-editor-theme-dropdown` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/047-editor-theme-dropdown/spec.md`

## Summary

The Editor Theme section's radio list becomes one dropdown populated from the already-discovered theme files, keeping the staged save model exactly as it is: choosing stages, Save commits and persists, closing discards. An unresolved committed selection renders a disabled placeholder instead of a false entry, and the quiet unreadable-files note stays put. Discovery, validation, application, and persistence code paths are untouched; the work is the control swap plus migrating every radio-based test to select interactions.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (React renderer only)

**Primary Dependencies**: None new.

**Storage**: None new (selection persistence unchanged).

**Testing**: Vitest unit updates for the dialog contract; Playwright e2e migration across five suites that exercise theme selection through radios today, reusing existing helpers and the spellcheck selector's interaction precedent.

**Target Platform**: All desktop platforms.

**Performance Goals**: N/A - static control in a dialog.

**Constraints**: FR-003 staging semantics must not drift; FR-004 requires an honest no-selection state; keep the fieldset accessibility name used by shared e2e helpers.

**Scale/Scope**: One component edit plus CSS reuse, one unit-test rewrite, five e2e specs updated. No main-process changes.

## Constitution Check

*GATE: presentation-layer change with behavioural invariants to protect.*

| Principle | Impact |
|-----------|--------|
| I / II | None - no IPC, Node, or path surface touched |
| III | Honoured - staged-save model preserved verbatim; nothing can silently commit or discard a theme choice differently than today |
| IV | Honoured - keyboard operability retained via native select (already inside the focus trap); fallback rendering on unresolved selection continues quietly |
| V | Honoured - the staging/discard/persistence behaviours are exactly the "what can corrupt" class here; all existing assertions are migrated, none deleted |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/047-editor-theme-dropdown/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
└── research.md    # R1-R6 with evidence
```

### Source Code (repository root)

```text
src/renderer/chrome/SettingsDialog.tsx   # EDIT: radios -> select at :360-376; onChange stages draft; sentinel placeholder option
src/renderer/chrome/settings.css         # EDIT (verify only): reuse .settings-select-label styles; minor width variant if needed
tests/renderer/settingsAbout.test.tsx    # EDIT: rewrite editor-theme staging tests against the select
tests/e2e/editor-theme.spec.ts           # EDIT: radio checks -> selectOption; count assertion -> option count
tests/e2e/json-editor-themes.spec.ts     # EDIT: checked-state assertions -> selected-option assertions
tests/e2e/settings.spec.ts               # EDIT: counts + reopened pair; replace arrow-key staging with keyboard select interaction
tests/e2e/editor-visual-fixes.spec.ts    # EDIT: four radio checks -> selectOption
package.json                             # EDIT: append touched files to scripts.format:check if newly created ones need it
```

**Structure Decision**: Confined to the dialog component and tests by design; research R5 shows zero main-process surface.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Copy the established select pattern**: markup and classes mirror the spellcheck language selector (`SettingsDialog.tsx:211-231`, `settings.css:141-163`), including a `data-testid="editor-theme"` for stable targeting.
- **D2 Staging via the same handlers**: select onChange sets `draftTouchedRef` and `setDraftEditorTheme`; Save gate (`!== null`) and discard-on-close untouched, so FR-003 holds structurally.
- **D3 Sentinel placeholder for null drafts**: a disabled, non-selectable option rendered only when the committed value matches no discovered theme, satisfying FR-004 without inventing state.
- **D4 Keep the fieldset/legend**: shared helper `openThemeArea` waits on the group's accessible name (`tests/e2e/launch.ts:76`), so retaining it minimises churn and keeps navigation semantics stable.
- **D5 Migrate, don't weaken, tests**: every radio assertion maps to an equivalent select assertion (option count, selected option after relaunch, close-discard, invalid-note content); the arrow-key staging test becomes keyboard open/adjust/Save, preserving its intent rather than deleting coverage.

## Complexity Tracking

> No constitution violations. The only semantic addition is the D3 sentinel, which exists to keep the fail-safe path honest under the new control type; simpler alternative (defaulting the select to the first theme) was rejected because it would display a selection that does not match the stored state.
