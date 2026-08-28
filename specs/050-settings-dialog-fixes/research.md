# Research: Settings Dialog Fixes

Feature: [spec.md](spec.md) | Plan: [plan.md](plan.md)

## R1: About area current shape and what removal touches

`src/renderer/chrome/AboutArea.tsx` (59 lines) renders three `.settings-about-row` rows: Version (label + value), Repository URL (label + button opening the repository via `window.api.openRepositoryUrl()`), and Revision (label + value + conditional Copy button writing `navigator.clipboard.writeText`). The revision value comes from `useBuildInfo()` -> `window.api.getBuildInfo()` (preload `src/preload/index.ts:159`, handler `src/main/ipc/handlers/build.ts`, composition `src/main/buildInfo.ts` with the `__BUILD_COMMIT__` define and `MM_BUILD_COMMIT` override).

Evidence for D1 (UI-only removal): `BuildInfo.revision` is consumed nowhere else in the renderer (grep across `src/renderer` shows only AboutArea reads `revision`). Removing the field from the shared contract would touch `ipc-contract.ts`, the main-process composition, and `tests/main/buildInfo.test.ts` / `buildHandlers.test.ts` for zero user-visible effect, and the spec (FR-003, Assumptions "Superseded requirement") names the panel's display, not the IPC shape. Rejected alternative: full contract removal. Rejected because it widens the change surface across the process boundary for a purely presentational requirement.

CSS: `.settings-about-label` (fixed `width: 110px`), `.settings-about-value`, `.settings-about-link`, `.settings-about-copy` in `src/renderer/chrome/settings.css:229-280`. After the removal `.settings-about-copy` has no remaining user.

## R2: Editor theme dropdown layout and the shared label class

`src/renderer/chrome/SettingsDialog.tsx:390-420` wraps the select in `<label className="settings-select-label" htmlFor="editor-theme"><span>Theme</span><select .../></label>`. The class (settings.css:141-150) is `display: flex; justify-content: space-between`, which is what pushes the select to the right edge of the row; the select box styling lives in `.settings-select-label select` (:152-163). The spellcheck Language row (SettingsDialog.tsx:219-239) uses the same class and must keep its right-aligned layout, so the class cannot be repurposed (evidence for D3): the theme select gets a standalone class carrying the same select box rules.

Accessible name today comes from the wrapping label's visible text "Theme" and is asserted by `tests/e2e/editor-theme.spec.ts:104` (`getByRole('combobox', { name: 'Theme', exact: true })`). Keeping `aria-label="Theme"` on the bare select (D2) preserves that name and every other suite's combobox lookups, satisfying FR-006 without contract changes. Rejected alternative: renaming to "Editor theme"; rejected because FR-006 says "retain" and FR-015 forbids unrequested changes, so the narrower reading wins.

The section legend "Editor Theme" (:391) already names the control, which is why the visible "Theme" span is redundant (spec US2).

## R3: Word wrap plumbing and the toggle surface

Current control: a `.settings-switch` checkbox row in the Markdown fieldset (SettingsDialog.tsx:284-294) wired to props `wordWrap` / `onWordWrapChange` (:62-63) passed from `App.tsx:428-429` to `handleWordWrapChange` in `src/renderer/hooks/useSettingsState.ts` (updates local state, renderer cache, and `window.api.updateSettings({ wordWrap })`).

Consumption: `App.tsx:387` -> `EditorPanel.tsx:17,49,128` -> `SourceView.tsx:15`, where `wrapCompartment` seeds `EditorView.lineWrapping` at construction (:83) and a prop-change effect reconfigures it live (:122-127) without touching document text, selection, or scroll. Toggling therefore already satisfies FR-011/FR-013; the only missing piece is a control inside SourceView.

Header bar: `SourceView.tsx:162-172` renders `.source-toolbar` (flex, settings in `editor.css:174-183`) whose only child is the `.source-return` back button at the far left. A last-child button with `margin-left: auto` lands at the far right without restructuring (D5). Styling mirrors `.source-return` (`editor.css:185-200`) so the bar keeps one visual language; state is carried by `aria-pressed` plus a pressed style rule keyed on the attribute (D4). Rejected alternative: a checkbox styled as a switch; rejected because the spec's assumption names a header-bar button following the existing button style, and `aria-pressed` is the canonical toggle-button semantics for FR-010.

A new `onWordWrapChange: (enabled: boolean) => void` prop threads App -> EditorPanel -> SourceView; SettingsDialog loses both word wrap props. Persistence, default (off), tolerant load of malformed values, and the debounced atomic write in `src/main/settingsFile.ts` / `settings.ts` are untouched (FR-012), as verified by the existing `tests/main/settings.test.ts` word-wrap describe.

## R4: Test blast radius

- Unit `tests/renderer/settingsAbout.test.tsx`: About assertions (version label, revision value, copy-to-clipboard), theme dropdown placeholders, and Markdown-area coverage; also a `wordWrap: false` prop stub. All need re-pointing.
- Unit `tests/renderer/useSettingsState.test.tsx:261-276` covers the word wrap handler, which survives unchanged (it moves from dialog wiring to source view wiring); only dialog-prop expectations change.
- E2E `tests/e2e/word-wrap.spec.ts` drives every scenario through `openMarkdownArea` + the settings switch; all scenarios keep their meaning but toggle via the header-bar button, plus new assertions for SC-008 (control absent from Settings) and FR-009/FR-010 (far-right position, state visibility).
- E2E `tests/e2e/about.spec.ts` asserts three rows and revision/dev-build behaviour; becomes two rows with an explicit no-revision-content check.
- E2E `tests/e2e/editor-theme.spec.ts` and `json-editor-themes.spec.ts` look the combobox up by its accessible name (survives) and, where they assert the label row layout, need alignment updates.
- E2E `tests/e2e/settings.spec.ts` asserts the Markdown area's switch list and the theme row; both shrink.

`package.json` `scripts.format:check` pins an explicit file list; touched files already on it need no action, new files would.
