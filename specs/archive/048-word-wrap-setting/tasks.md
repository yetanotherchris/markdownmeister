# Tasks: Source View Word Wrap Setting

## Phase 1: Settings pipeline

- [x] 1.1 Add `wordWrap` to `Settings` in `src/shared/ipc-contract.ts`
- [x] 1.2 Main process: DEFAULTS (`false`), `validateSettings`, `mergeSettingsPatch`, strict boolean patch check, legacy-migration key list in `src/main/settingsFile.ts`
- [x] 1.3 Renderer default in `src/renderer/state/settings.ts`

## Phase 2: Renderer state and editor surfaces

- [x] 2.1 State + handler in `src/renderer/hooks/useSettingsState.ts`
- [x] 2.2 Pass `wordWrap` from App through `EditorPanel` to `SourceView`
- [x] 2.3 `SourceView`: compartment-held lineWrapping extension + reactive reconfiguration effect

## Phase 3: Settings dialog

- [x] 3.1 Props + Markdown-area switch row in `src/renderer/chrome/SettingsDialog.tsx`

## Phase 4: Tests

- [x] 4.1 `tests/main/settings.test.ts`: malformed-value recovery + patch validation cases
- [x] 4.2 `tests/renderer/useSettingsState.test.tsx`: handler updates cache + IPC
- [x] 4.3 `tests/renderer/settingsAbout.test.tsx`: baseProps gains the new props
- [x] 4.4 `tests/e2e/word-wrap.spec.ts`: immediate effect, mid-edit safety, persistence via config polling, adversarial config, large-document typing smoke

## Phase 5: Gates

- [x] 5.1 npm run lint / typecheck / test green; scoped e2e green; prettier clean on touched files
