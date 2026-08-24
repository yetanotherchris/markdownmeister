# Research: Editor Theme Dropdown Selection

Date: 2026-08-24. Every claim verified against this worktree during planning.

## R1 - The control being replaced

**Decision**: Swap the mapped radio labels for a single select element; keep everything around it.

**Evidence**: The radio group renders at `SettingsDialog.tsx:360-376` inside `<fieldset className="settings-fieldset"><legend className="settings-legend">Editor Theme</legend>` (:360-361), one `label.settings-radio` per theme with `name="editor-theme"`, checked bound to `draftEditorTheme`, and onChange staging via `draftTouchedRef.current = true` plus `setDraftEditorTheme(option.name)` (:369-372). The quiet invalid-files note sits at :377-381 (`.settings-theme-invalid-note`, styled `settings.css:135-139`). Save is gated on `draftEditorTheme !== null` at :393-402, and the draft seeds from the committed value only when that value matches a discovered theme (`stageableTheme`, :86-93).

## R2 - In-app dropdown precedent to copy

**Decision**: Model the select on the spellcheck language selector, the renderer's only existing dropdown, including its CSS classes and test id convention.

**Evidence**: JSX at `SettingsDialog.tsx:211-231` (`label.settings-select-label` with `htmlFor`, `select` carrying `data-testid="spellcheck-language"`); styles `.settings-select-label` / `.settings-select-label select` at `settings.css:141-163` with focus ring in the shared block at :352. The dialog's focus trap already enumerates selects (`SettingsDialog.tsx:130-132`), so keyboard cycling needs no new code. A second select introduces no new pattern risk.

## R3 - Staging semantics carry over unchanged

**Decision**: The select's onChange performs exactly what the radios' onChange did; the Save gate and discard-on-close paths are untouched.

**Evidence**: Draft state machine at `SettingsDialog.tsx:86-93` (draft + touched ref) and refresh-reseed effect at :108-118 (reseeds only while untouched). Staging behaviour is pinned by e2e today: arrow-key staging without canvas change (`tests/e2e/settings.spec.ts:283-300`) and close-without-save discarding (`tests/e2e/editor-theme.spec.ts:129-145`); those interactions get re-expressed for a select rather than removed.

## R4 - Placeholder for an unresolved committed selection

**Decision**: When the committed theme matches no discovered file (draft is null), render a disabled placeholder option as the current value; selecting a real entry stages normally; the placeholder can never be re-chosen after leaving it.

**Evidence**: Null draft means "stored name matched nothing" by construction of `stageableTheme` (:86-93); the fallback-and-repair machinery lives in main (`src/main/ipc/handlers/themes.ts:19-29` repairs via `unresolvedSelectionRepair`) and is unaffected by presentation. A native select cannot show "nothing" without a sentinel option, so the sentinel is required to satisfy FR-004 honestly rather than displaying a false selection.

## R5 - Discovery pipeline untouched

**Decision**: No changes to listing, validation, ordering, or IPC.

**Evidence**: `themes:list` handler (`src/main/ipc/handlers/themes.ts:32`), directory resolution (`src/main/themes/path.ts:4-6`), listing/validation with case-collision and symlink handling plus alphabetical sort (`src/main/themes/store.ts:43-116`), preload op (`src/preload/index.ts:85`), renderer cache (`src/renderer/state/editorThemes.ts`). The dialog already refreshes on mount (`SettingsDialog.tsx:108-118`), satisfying FR-002/FR-007 with zero new logic.

## R6 - Test migration inventory

**Decision**: Enumerate and migrate every radio-based assertion; keep group-name-based helpers working by retaining the fieldset/legend.

**Evidence**: Helper dependency: `tests/e2e/launch.ts:71-77` waits on `getByRole('group', { name: 'Editor Theme' })`. Suites touching editor-theme radios: `tests/e2e/editor-theme.spec.ts` (:95-107 count of five, :109-127 save gating, :129-145 close-discard, :147-163 persistence, :177-282 rendering, :293-299 invariant loop, :336 malformed config), `tests/e2e/json-editor-themes.spec.ts` (:132, 145, 161, 182, 203, 216, 272-276 checked-state assertions; :278-282 invalid note, which survives unchanged), `tests/e2e/settings.spec.ts` (:126-131 counts, :218-220 reopened checked pair, :238 restart, :283-300 arrow-key staging needing redesign), `tests/e2e/editor-visual-fixes.spec.ts` (:163, 190-191, 264, 295). Unit: `tests/renderer/settingsAbout.test.tsx:250-263` drives `input[name="editor-theme"]` and asserts save-call counts; rewrite against the select. Dropdown interaction precedent: `tests/e2e/spellcheck.spec.ts:225` (`selectOption`).

**Alternatives considered**: renaming/removing the fieldset - would break every helper wait for zero benefit. Rejected. Custom combobox component - accessibility burden, no requirement. Rejected.

## References

- Current radio group and staging: `src/renderer/chrome/SettingsDialog.tsx:86-118, 360-402`
- Select precedent: `src/renderer/chrome/SettingsDialog.tsx:211-231`, `src/renderer/chrome/settings.css:141-163`
- Discovery/repair: `src/main/ipc/handlers/themes.ts:19-32`, `src/main/themes/store.ts:43-116`
