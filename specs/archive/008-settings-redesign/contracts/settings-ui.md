# Settings UI Contract

## Settings Dialog

- The modal retains `role="dialog"`, `aria-modal="true"`, heading `Settings`, Escape dismissal, outside-click dismissal, and focus return to the hamburger trigger.
- Its dialog width accommodates a persistent left sidebar and a right content panel at desktop widths. At narrow window widths it remains within the viewport without overlap.
- Sidebar buttons are labelled `General` and `Theme`, expose the selected state, and show only the selected area's controls.
- Each mount starts with General selected, regardless of the area selected when a prior modal instance closed.
- Focus trapping includes enabled buttons, checkbox/switch inputs, radio inputs, and selects.

## General Area

| Control | Accessible name | Value | Effect |
|---------|-----------------|-------|--------|
| Spellcheck switch | `Check spelling while typing` | Existing boolean | Existing immediate spellcheck behavior |
| Spellcheck language | `Language` | Existing language or system default | Existing immediate language behavior |
| File preference | `Open files in a new tab` | `fileOpenBehavior === 'new-tab'` | Immediately controls explorer open decisions |

Every boolean control is a semantic native checkbox styled as a pill switch. The file preference's label reads `Open files in a new tab` (renamed from `Open explorer files in a new tab` on 2026-08-10); its checked state is the single state signal (clarified 2026-08-09: the adjacent Same tab/New tab helper text was removed).

## Theme Area

The existing application Theme radio group and Editor Theme radio group move intact to this area. Application theme remains immediate. Editor theme remains staged and commits only through Save; Close, Escape, and backdrop dismissal discard its uncommitted selection.

## Explorer And Developer Tools

- Explorer single-click, item activation, and context-menu Open must use `fileOpenBehavior`; a currently open target activates its existing tab rather than duplicating it.
- File-menu and recent-item opens must not consume `fileOpenBehavior`.
- The hamburger never displays Toggle Developer Tools and the obsolete renderer `toggleDevTools` bridge is removed.
- F12 and Ctrl/Cmd+Shift+I are prevented in main and always toggle developer tools. There is no settings entry and no `developerToolsEnabled` field.

## Settings IPC Validation

- `settings:update` continues to accept a partial settings object through the named preload operation.
- A present `fileOpenBehavior` must be exactly `same-tab` or `new-tab`.
- Invalid values return the existing typed `IO` error result and leave the in-memory and persisted settings unchanged.

## Editor Presentation

- A short formatted document leaves no app-background strip below the content: `.milkdown` covers the full `.editor-host` height and keeps the selected editor theme's canvas color. A saved editor-theme change updates that canvas immediately.
- The source-view button remains last in Crepe's top bar, retains title and accessible name `View source`, uses Heroicons outline code-bracket-square SVG markup, and resolves to `rgb(37, 99, 235)` in both app themes.
