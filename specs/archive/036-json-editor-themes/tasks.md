# Tasks: File-Based Editor Themes

**Input**: plan.md, research.md, data-model.md, contracts/preload.md

**Organization**: main-process foundation first (pure core → IPC → wiring), then renderer consumption in three compilable slices (additive layer → dialog switch → withdrawal), then e2e and gates. Each task is one commit; structural and behavioural changes are never mixed.

## Phase 1: Planning artifacts

- [x] T001 Write specs/036-json-editor-themes/{plan.md, research.md, data-model.md, quickstart.md, contracts/preload.md, tasks.md} and add the dated Clarification + migration-name Assumption to spec.md. Commit `docs(036)`.

## Phase 2: Shared tokens module (additive)

- [x] T002 Create src/shared/editorThemeTokens.ts: the five embedded default theme contents (typefaces + palettes verbatim per research E1/E2), `fontStackFor`, `isSerifTypeface`, `DEFAULT_EDITOR_THEME_NAME` ('rustic'), `MIGRATED_CUSTOM_THEME_FILE` ('migrated-custom.json'), emergency palette accessor; unit tests in tests/renderer/editorThemeTokens.test.ts pinning every hex value against today's constants. Existing code untouched (transitional duplication resolved in T008). Commit `feat(036)`.

## Phase 3: Main process (pure core → IPC → startup)

- [x] T003 Create src/main/themes/validate.ts (pure parse/validate per data-model §Validation rules) and src/main/themes/store.ts (ensure directory; seed ONLY missing defaults via atomicWrite; discovery with hidden/wrong-extension/subdirectory filtering, size cap, case-collision resolution, deterministic ordering) — electron-free. Unit tests tests/main/themes/store.test.ts covering: fresh seed = exactly five files with expected content; existing files never rewritten (marker survives); missing subset recreated; the full invalid matrix (bad JSON / missing light / missing dark / bad colour / wrong types / oversized); unknown extra keys ignored; wrong-extension + hidden + subdirectory ignored; case-collision winner rule + loser reported; ordering. Commit `test(036)` (red) then `feat(036)` (green) or a single green commit if written together.
- [x] T004 Create src/main/themes/migration.ts (spec-023 detection mirror: default-combo repair / migrated-custom.json creation; idempotent; tolerant of absent/invalid legacy fields; atomic create-only writes) plus src/main/themes/path.ts (MM_CONFIG_DIR-aware themes dir). Unit tests tests/main/themes/migration.test.ts: exact default combos for all five (incl. monotone either variant, font disambiguating rustic vs rustic-serif); non-default combo creates the file with both sets + typeface and repairs selection; idempotency across two runs; invalid legacy colours no-op; existing migrated-custom.json never overwritten. Commit `feat(036)`.
- [x] T005 Add IPC surface: ipc-contract types (`EditorThemeDefinition`, `EditorThemesList`, `DesktopApi.getEditorThemes`) + Settings.editorTheme widened to validated string (settingsFile `isValidEditorThemeName` in validate+merge+strict patch check) + preload named op + src/main/ipc/handlers/themes.ts (authorized handler with silent repair per contracts/preload.md) + register.ts teardown entry. Unit tests: name validation matrix, repair helper behaviour, handler authorization. Commit `feat(036)`.

## Phase 4: Startup wiring

- [x] T006 Wire src/main/index.ts bootApp: ensure dir + seed missing defaults + run migration BEFORE the first loadSettings() call (repaired selection reaches the preload path). Manual smoke via dev run optional; covered by e2e in T010. Commit `feat(036)`.

## Phase 5: Renderer consumption

- [x] T007 Additive delivery layer: src/renderer/state/editorThemes.ts (cache + loadEditorThemesFromMain + refresh + pure paletteForMode/findTheme), preload before first render in src/renderer/main.tsx, App.tsx additionally applies inline `--mm-theme-*` variables (+ serif attribute) from the resolved definition with emergency fallback, generic mapping block appended to themes.css (after preset blocks; custom block untouched yet), useSettingsState exposes editorThemes + refreshEditorThemes. No visible change yet (values equal the base layer). Unit tests: paletteForMode light/dark selection, fallback resolution when the stored name is missing. Commit `feat(036)`.
- [x] T008 Dialog switch: SettingsDialog renders radios from the delivered list (labels = stems verbatim), refreshes on every mount, stages by name, Save stores the name through settings:update; useSettingsState.handleEditorThemeChange simplifies to persisting the name; App resolves `data-editor-theme` from the delivered definitions ('default' + emergency when unresolved). Update tests/e2e/editor-theme.spec.ts labels ('Rustic' → 'rustic', …) and any assertions that referenced title-case labels. Commit `feat(036)`.
- [x] T009 Withdrawal: delete src/renderer/editorThemes.ts registry, custom CSS block + `--mm-custom-*` plumbing in App.tsx, resolveEditorTheme/presetColorsFor/presetFontFor (delete src/shared/editorThemePresets.ts), Custom radio remnants, and remove `editorColors`/`editorFont` from Settings/DEFAULTS/validation/merge/renderer cache/state; delete tests/e2e/editor-theme-custom.spec.ts, tests/renderer/editorThemes.test.ts, tests/renderer/editorThemePresets.test.ts; update tests/main/settings.test.ts and any remaining references. Commit `feat(036)`.

## Phase 6: E2E coverage

- [x] T010 Create tests/e2e/json-editor-themes.spec.ts covering the required scenarios: fresh start seeds exactly five files; selection persists across relaunch (same configDir); editing a token then reopening settings applies the new colour (computed CSS var assertion); adding a valid file appears next dialog open; deleting the selected theme's file falls back + repairs with NO error dialog (`messageBoxCallCount` === 0); malformed files (bad JSON / missing dark node / bad colour value / junction-symlink out of folder / subdirectory) ignored quietly with others intact; legacy custom-colour config fixture migrates to migrated-custom.json selectable in both appearances; monotone switches palettes live on appearance toggle while a static default does not change. Update package.json scripts.format:check with all new source/test files. Commit `test(036)`.

## Phase 7: Gates & archive

- [x] T011 Run gates until green, in order: `npm install` (once at start), `npm run lint`, `npm run typecheck`, `npm test`, `npm run check`, `npx prettier --check` on new/edited files, then `npm run test:e2e` (retry up to 3× on machine-contention failures). Fix findings; record results.
- [x] T012 Archive: `git mv specs/036-json-editor-themes specs/archive/036-json-editor-themes`, set **Status** to Archived in spec.md. Commit `docs(specs)`.

## Dependencies

T002 → T003/T004 (templates/constants) → T005 (payload types) → T006; T007 depends on T005/T006 (channel exists); T008 depends on T007; T009 depends on T008 (removal only after the switch compiles without the old path); T010 after T009; T011/T012 last.

## Notes

- Every commit compiles and keeps the suite green except where a task explicitly lands red-then-green (T003 option).
- No push, no merge, no version bumps, no installer/script edits (implementation order constraints).
