# Tasks: Formatting Bar Visibility Setting

## Phase 1: Settings pipeline

- [x] 1.1 Add `formattingBarVisible` to `Settings` in `src/shared/ipc-contract.ts`
- [x] 1.2 Main process: DEFAULTS (`true`), `validateSettings`, `mergeSettingsPatch`, strict boolean patch check, legacy-migration key list in `src/main/settingsFile.ts`
- [x] 1.3 Renderer default in `src/renderer/state/settings.ts`
- [x] 1.4 Verify no handler change needed in `src/main/ipc/handlers/settings.ts` (generic boolean patch validation covers it)

## Phase 2: Renderer state and application

- [x] 2.1 State + handler in `src/renderer/hooks/useSettingsState.ts`
- [x] 2.2 Wire hook to dialog props and set `data-formatting-bar` on `.app-container` in `src/renderer/App.tsx`

## Phase 3: Presentation

- [x] 3.1 Markdown-area switch row in `src/renderer/chrome/SettingsDialog.tsx`
- [x] 3.2 `display: none` rule under `[data-formatting-bar='off']` in `src/renderer/editor/editor.css`

## Phase 4: Tests

- [x] 4.1 `tests/main/settings.test.ts`: malformed-value recovery + patch validation cases
- [x] 4.2 `tests/renderer/useSettingsState.test.tsx`: handler updates cache + IPC
- [x] 4.3 `tests/renderer/settingsAbout.test.tsx`: baseProps gains the new props
- [x] 4.4 `tests/e2e/formatting-bar-visibility.spec.ts`: toggle immediacy, zero reserved height, focus safety, restart persistence, adversarial config

## Phase 5: Gates

- [x] 5.1 npm run lint / typecheck / test green; scoped e2e green; prettier clean on touched files
