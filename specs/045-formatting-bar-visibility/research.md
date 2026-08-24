# Research: Formatting Bar Visibility Setting

Date: 2026-08-24. Every claim verified against this worktree during planning.

## R1 - Application mechanism: data attribute plus CSS, not editor feature flags

**Decision**: Expose the preference on the root container as `data-formatting-bar="on|off"` and hide the bar with a `display: none` rule scoped to that attribute. Do not attempt to reconfigure editor features per instance.

**Evidence**: Crepe features are fixed at construction and editors are long-lived, one per tab (`CrepeHost.tsx:121-146` builds the feature map; `[CrepeFeature.TopBar]: true` at :130; instances registered per document in the pool). Recreating every editor on toggle would discard undo history and pay a full parse per tab, violating calm-editing expectations. The attribute pattern already exists for a purely presentational preference: `App.tsx:292` sets `data-visual-code-highlighting` on `.app-container`, consumed by `editor.css:223`. DOM-level control of the bar after mount is proven by `applyInert`, which toggles `inert` on `.milkdown-top-bar` elements (`CrepeHost.tsx:85-92`). The bar element is `.milkdown .milkdown-top-bar`, styled at `editor.css:45-59`.

**Alternatives considered**:

- *Feature-flag recreation* - destroys undo state, expensive. Rejected.
- *`inert` only (applyInert style)* - keeps layout space, failing FR-003/SC-005. Rejected as the primary mechanism (it remains available if interaction suppression is ever needed independently).
- *Per-instance React prop into each host* - threads one boolean through every panel for what is a single global presentation property; the attribute applies to all surfaces at once. Rejected.

## R2 - Settings plumbing: one new boolean through the existing chain

**Decision**: Add `formattingBarVisible: boolean` (default `true`) to the settings contract and thread it exactly where every other boolean travels. No new IPC channel: the patch rides the existing settings-update operation, keeping the preload surface fixed.

**Evidence**: Settings type at `src/shared/ipc-contract.ts:145-172`; API operations `getSettings`/`updateSettings` at :201-202 mapped to fixed channels in `src/preload/index.ts:83-84`. Main-process touch points: `DEFAULTS` (`src/main/settingsFile.ts:8-18`), tolerant load validation falling back per field (:43-88), patch merge (:90-131), strict boolean checks via the boolean array at :150-158, and the legacy-migration known-key list (:178-193). Renderer: defaults duplicated at `src/renderer/state/settings.ts:4-14`; handler pattern at `src/renderer/hooks/useSettingsState.ts:133-139` (state + cache + IPC call); App wiring passes props into the dialog (`App.tsx:396-415`). Old configs migrate by omission since absent keys fall back to defaults during load validation (recovery precedent tested at `tests/main/settings.test.ts:860-874`).

## R3 - Control placement and shape

**Decision**: A switch row in the Markdown area's existing fieldset, first among the switches or grouped with view-related ones, labelled around "Show formatting bar".

**Evidence**: The Markdown area renders seven identical switch rows today (`SettingsDialog.tsx:250-342`); the template row with its exact class conventions is at :254-264 (`settings-switch`, hidden checkbox input, track span, text span). All are immediate-commit controls (only the editor theme selection is staged, `SettingsDialog.tsx:89-93, 393-402`), so this setting commits on click like its neighbours, consistent with FR-002's immediacy.

## R4 - Testing strategy

**Decision**: Mirror the closest existing suites rather than inventing new harness patterns.

**Evidence**: Unit - hook behaviour tests stub `window.api.updateSettings` and assert cache plus IPC patch (`tests/renderer/useSettingsState.test.tsx:111-127`); any new dialog prop must join `baseProps()` in `tests/renderer/settingsAbout.test.tsx:76-97` or TypeScript fails; main-process recovery test precedent at `tests/main/settings.test.ts:860-874`. E2E - the Markdown-area suite `tests/e2e/markdown-syntax-options.spec.ts` supplies the toggle helper and persistence polling patterns (:78-99, :269-296 for an attribute-driven non-dirtying toggle), and bar visibility probes exist in `tests/e2e/app.spec.ts:90` (`.milkdown-top-bar` visible) and `tests/e2e/header-bar-shade.spec.ts:50`. Persistence assertions must poll the config file because main writes debounced at 500 ms (`src/main/settings.ts:60-73`).

## References

- Attribute-driven presentation precedent: `src/renderer/App.tsx:292`, `src/renderer/editor/editor.css:223`
- Bar element and styles: `src/renderer/editor/CrepeHost.tsx:85-92`, `src/renderer/editor/editor.css:45-59`
- Settings chain: `src/shared/ipc-contract.ts:145-172`, `src/main/settingsFile.ts:8-193`, `src/renderer/state/settings.ts:4-14`, `src/renderer/hooks/useSettingsState.ts:133-139`
