# Tasks: Editor Theme Dropdown Selection

## Phase 1: Control swap

- [x] 1.1 Replace the editor-theme radio list with a single native select in `src/renderer/chrome/SettingsDialog.tsx`, staging via the existing draft handlers
- [x] 1.2 Sentinel disabled placeholder option rendered only when the committed selection matches no discovered theme (FR-004)
- [x] 1.3 Verify CSS reuse of `.settings-select-label`; adjust only if visually necessary

## Phase 2: Unit tests

- [x] 2.1 Rewrite the editor-theme staging tests in `tests/renderer/settingsAbout.test.tsx` against the select

## Phase 3: E2E migration (migrate, do not weaken)

- [x] 3.1 `tests/e2e/editor-theme.spec.ts`: counts, save gating, close-discard, persistence, rendering, invariant loop, malformed config
- [x] 3.2 `tests/e2e/json-editor-themes.spec.ts`: checked-state assertions to selected-option assertions; invalid note retained
- [x] 3.3 `tests/e2e/settings.spec.ts`: counts, reopened pair, restart, arrow-key staging redesigned as keyboard select interaction
- [x] 3.4 `tests/e2e/editor-visual-fixes.spec.ts`: four radio checks to selectOption

## Phase 4: Gates

- [x] 4.1 npm run lint / typecheck / test green; affected e2e suites green; prettier clean on touched files
