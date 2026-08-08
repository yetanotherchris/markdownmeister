# Data Model: Settings Redesign

## Persisted Settings

The existing `config.json` shape remains `{ recentItems?: RecentItem[], settings?: Settings }`. Missing or malformed fields fall back independently to defaults; writes remain atomic through `writeSettingsFile`.

| Field | Type | Default | Validation | Used by |
|-------|------|---------|------------|---------|
| `fileOpenBehavior` | `'same-tab' | 'new-tab'` | `'same-tab'` | Closed union | Explorer open decision |
| `developerToolsEnabled` | `boolean` | `false` | Boolean | Main shortcut gate |
| `spellcheckEnabled` | `boolean` | `true` | Existing boolean | General area |
| `spellcheckLanguage` | `SpellcheckLanguage | null` | `null` | Existing closed union | General area |
| `themeOverride` | `'light' | 'dark' | null` | `null` | Existing closed union | Theme area |
| `editorTheme` | `EditorThemeName` | `'rustic'` | Existing closed union | Theme area |

The persisted internal fields `sidebarWidth`, `explorerVisible`, `editorFont`, and `editorColors` are not new dialog controls and retain their existing behavior.

For `settings:update`, a payload which includes an invalid value for either new field is rejected with the existing typed `IO` result. Invalid fields are never silently normalized or persisted.

## Settings Area

| Area | Initial state | Contents | Persistence model |
|------|---------------|----------|-------------------|
| `general` | Selected whenever the modal mounts | Spellcheck toggle and language, file-opening preference, developer-tools toggle | Immediate |
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

| `developerToolsEnabled` | Existing shortcut | Open developer tools | Hamburger item |
|-------------------------|-------------------|----------------------|----------------|
| `false` | Prevented with no toggle | Closed immediately when changed to false | Absent |
| `true` | Toggles developer tools | Opens or closes as Electron currently does | Absent |
