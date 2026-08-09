# Data Model: Settings Redesign

## Persisted Settings

The existing `config.json` shape remains `{ recentItems?: RecentItem[], settings?: Settings }`. Missing or malformed fields fall back independently to defaults; writes remain atomic through `writeSettingsFile`.

| Field | Type | Default | Validation | Used by |
|-------|------|---------|------------|---------|
| `fileOpenBehavior` | `'same-tab' | 'new-tab'` | `'same-tab'` | Closed union | Explorer open decision |
| `spellcheckEnabled` | `boolean` | `true` | Existing boolean | General area |
| `spellcheckLanguage` | `SpellcheckLanguage | null` | `null` | Existing closed union | General area |
| `themeOverride` | `'light' | 'dark' | null` | `null` | Existing closed union | Theme area |
| `editorTheme` | `EditorThemeName` | `'rustic'` | Existing closed union | Theme area |

The persisted internal fields `sidebarWidth`, `explorerVisible`, `editorFont`, and `editorColors` are not new dialog controls and retain their existing behavior. `editorColors` is written with the preset's exact colours whenever a preset is saved (spec 023, clarified 2026-08-09: presets are materialised in the config rather than stored as `null`; monotone stores the resolved app-theme variant's palette).

Developer tools are not part of the settings model. The F12 and Ctrl/Cmd+Shift+I shortcuts always toggle them; no `developerToolsEnabled` field exists.

For `settings:update`, a payload which includes an invalid value for the new field is rejected with the existing typed `IO` result. Invalid fields are never silently normalized or persisted.

## Settings Area

| Area | Initial state | Contents | Persistence model |
|------|---------------|----------|-------------------|
| `general` | Selected whenever the modal mounts | Spellcheck toggle and language, file-opening preference | Immediate |
| `theme` | Selected by sidebar interaction | Application theme radios, staged editor-theme radios | App theme immediate; editor theme Save-gated |

## Explorer Open Decision

| Condition | Result |
|-----------|--------|
| Requested file is already open | Activate existing tab |
| Explorer middle-click | Open a new tab |
| Preference is `new-tab` | Open a new tab |
| Preference is `same-tab` and active tab is live-clean | Replace active tab |
| Preference is `same-tab` and active tab is dirty or absent | Open a new tab |

Only explorer single-click, activation, and context-menu Open use this table. File-menu and recent-item operations retain their existing decision path.

## Developer Tools State

| Keyboard shortcut | Open developer tools | Hamburger item |
|-------------------|----------------------|----------------|
| F12 / Ctrl/Cmd+Shift+I | Always toggles developer tools | Absent |
