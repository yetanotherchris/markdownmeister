# Tasks: Settings Dialog Fixes

## Phase 1: Word wrap moves to the source view header bar

- [X] 1.1 Thread `onWordWrapChange` through `App.tsx` -> `EditorPanel.tsx` -> `SourceView.tsx`; stop passing `wordWrap`/`onWordWrapChange` to `SettingsDialog` and delete them from its props and Markdown area
- [X] 1.2 `SourceView.tsx`: add the `aria-pressed` "Word Wrap" toggle button as the rightmost control in `.source-toolbar`; `editor.css`: style it after `.source-return` with a pressed state and `margin-left: auto`

## Phase 2: About area simplification

- [X] 2.1 `AboutArea.tsx`: remove the "Version" label, the Revision row with its Copy button, and the now-unused copy handler; `settings.css`: delete `.settings-about-copy`

## Phase 3: Editor theme dropdown alignment

- [X] 3.1 `SettingsDialog.tsx`: render the theme select bare (no visible "Theme" label) with `aria-label="Theme"`, starting at the section's left content edge; `settings.css`: standalone select style reusing the current box rules

## Phase 4: Tests

- [X] 4.1 `tests/renderer/settingsAbout.test.tsx`: About shows bare version + unchanged repository row + zero revision content; theme dropdown has no visible label but keeps its accessible name; Markdown area has no word wrap switch and the remaining switches intact
- [X] 4.2 `tests/renderer/useSettingsState.test.tsx`: drop word wrap from dialog props; keep the handler coverage against the new wiring
- [X] 4.3 `tests/e2e/word-wrap.spec.ts`: all scenarios toggled via the header-bar button; add far-right position, state visibility, visual-editor-unchanged, and settings-absence checks
- [X] 4.4 `tests/e2e/about.spec.ts`: two rows, bare version, repository link still external, no revision content anywhere in the panel
- [X] 4.5 `tests/e2e/editor-theme.spec.ts`, `json-editor-themes.spec.ts`, `settings.spec.ts`: left-edge alignment, accessible name without visible label, Markdown-area switch list without word wrap

## Phase 5: Gates

- [X] 5.1 `npm run lint` / `typecheck` / `test` / `test:e2e` green; `format:check` list current
- [X] 5.2 Archive the spec (`git mv` to `specs/archive/050-settings-dialog-fixes`, Status: Archived) with the implementation PR
