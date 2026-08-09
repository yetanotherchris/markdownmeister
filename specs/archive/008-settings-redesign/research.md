# Research: Settings Redesign

## R1: Reuse the settings boundary

**Decision**: Extend the existing `Settings` model and its `getSettings` / `updateSettings` operations with `fileOpenBehavior: 'same-tab' | 'new-tab'`. The developer-tools toggle field previously added to this feature is removed: developer tools are always available and are not part of the settings model.

**Rationale**: `src/main/settingsFile.ts` already performs tolerant field-by-field loading, closed-value validation, atomic shared-config writes, and legacy migration. `src/main/settings.ts` retains an authoritative in-memory snapshot so updates cannot race within the debounce window. Reusing the named operations preserves the fixed preload surface. Keeping the developer-tools setting out of the model means no persistence, validation, or migration surface for a value the app never reads.

**Alternatives considered**: A new IPC operation for each control increases the attack surface without adding validation or persistence value. Renderer-only state fails the restart-persistence requirement. Retaining a persisted `developerToolsEnabled` that nothing gates against would be dead state.

**IPC validation**: A caller that supplies a present `fileOpenBehavior` outside the closed union receives the existing typed `IO` result before the patch reaches merge logic. This covers the new untrusted IPC field without changing the established handling of unrelated legacy fields.

## R2: Keep the tab-replacement safety boundary

**Decision**: Add an explorer-specific session open entry point that reads `fileOpenBehavior`; leave the current generic file-menu and recent-item entry point unchanged.

**Rationale**: `openFileFromTree` currently serves explorer, File-menu, and recent-item operations. The specification limits the preference to explorer actions. The new explorer path retains the existing live `isDirtyLive` guard, existing-tab activation precedence, and explicit-new middle-click behavior.

**Alternatives considered**: Changing the shared helper silently changes File-menu and recent-item behavior outside the specification. Replacing a dirty tab would violate Principle III.

## R3: Toggle developer tools unconditionally in main

**Decision**: Remove the hamburger action and its renderer IPC bridge (already done). In `src/main/shortcuts.ts`, prevent the recognized shortcut and always toggle developer tools. There is no settings gate and no `developerToolsEnabled` field.

**Rationale**: Hiding an action in the renderer is not an authorization boundary; the main process owns Electron's `webContents` and is the only place the toggle can be implemented. The developer-tools setting proved unnecessary — the F12/Ctrl/Cmd+Shift+I shortcuts are a fixed, harmless surface and a persisted toggle for them was judged useless, so the setting was removed (spec clarification 2026-08-08). Removing the setting also shrinks the settings model and the preload API.

**Alternatives considered**: Gating on a persisted boolean (as first planned) added a settings entry for no user-visible benefit. Conditionally showing the old hamburger action conflicts with the specification's move out of the menu.

## R4: Use native controls with custom switch styling

**Decision**: Keep native checkbox and radio controls, style booleans as pill switches, and add General/Theme sidebar buttons with selected state.

**Rationale**: Native controls preserve keyboard and screen-reader semantics. CSS can create the requested Tailwind-style visual language without a dependency. The focus trap is expanded from radios and buttons to all enabled inputs and selects.

**Alternatives considered**: A custom div switch requires recreating keyboard semantics. A third-party forms package is unnecessary for two settings areas.

## R5: Fill the formatted canvas, not the app background

**Decision**: Apply `min-height: 100%` to the formatted `.milkdown` surface inside the full-height `.editor-host`.

**Rationale**: Editor themes already assign the canvas color to `.milkdown`; short content leaves only the surrounding app background exposed. Filling the surface extends the correct theme canvas without affecting the source-view or empty-state backgrounds.

**Alternatives considered**: Applying editor-theme colors to `.editor-area` would incorrectly change the source view. A JavaScript resize listener adds unnecessary work for a CSS layout issue.

## R6: Use an outline Heroicon with a fixed color

**Decision**: Embed the installed Heroicons outline code-bracket-square SVG path in `CrepeHost` and style it with `#2563eb`, no fill, and `currentColor` stroke.

**Rationale**: Crepe accepts toolbar icons as SVG markup, while Heroicons supplies React components. The fixed color meets the cross-theme requirement and avoids the current app-accent color changing with the chrome theme.

**Alternatives considered**: Passing a React component does not match Crepe's icon API. Retaining the accent token violates the fixed dark-blue requirement.
