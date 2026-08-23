# Data Model: File-Based Editor Themes

Date: 2026-08-23. What a theme file is, what the settings store holds, and what crosses the IPC boundary.

## Theme file (`<configDir>/themes/<name>.json`)

The file's base name (stem) is the theme's identity and display label. There is no name property inside the file.

```json
{
  "typeface": "<css font-family string>",
  "light": { "background": "#rrggbb", "foreground": "#rrggbb", "accent": "#rrggbb", "surface": "#rrggbb", "outline": "#rrggbb", "code": "#rrggbb" },
  "dark":  { "background": "#rrggbb", "foreground": "#rrggbb", "accent": "#rrggbb", "surface": "#rrggbb", "outline": "#rrggbb", "code": "#rrggbb" }
}
```

Token property names are identical to the existing curated custom-property names (`--mm-custom-*` minus prefix / `EditorColors` keys). Unknown extra keys — top-level or inside a palette — are ignored (forward compatibility).

### Embedded defaults (seeded verbatim; rendering unchanged)

| File stem | typeface (verbatim source) | light set | dark set |
|-----------|-----------------------------|-----------|----------|
| `rustic` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif` | rustic | rustic |
| `rustic-serif` | `Georgia, 'Times New Roman', 'Noto Serif', serif` | rustic | rustic |
| `scholarly` | `Arial, 'Helvetica Neue', Helvetica, sans-serif` | scholarly | scholarly |
| `monotone` | Inter stack | monotone-light | monotone-dark (differing — follows appearance) |
| `monotone-serif` | Georgia stack | monotone-light | monotone-dark (differing — follows appearance) |

Palettes (hex, from src/shared/editorThemePresets.ts:25-66):

- rustic: background `#fdf6e3`, foreground `#1f1b16`, accent `#805610`, surface `#fdf3d9`, outline `#817567`, code `#ba1a1a`
- scholarly: `#ffffff`, `#1a1a1a`, `#00b0e9`, `#f7f7f7`, `#8a8a8a`, `#b50000`
- monotone-light: `#ffffff`, `#000000`, `#000000`, `#ffffff`, `#808080`, `#000000`
- monotone-dark: `#000000`, `#ffffff`, `#ffffff`, `#000000`, `#808080`, `#ffffff`

Static defaults ship IDENTICAL light+dark sets; only monotone/monotone-serif differ. Scholarly's file typeface is its rendered Arial stack even though its legacy two-value choice is `sans-serif` (research E2); migration matches on the choice.

Legacy font-choice table used by migration matching only: rustic `sans-serif`, rustic-serif `serif`, scholarly `sans-serif`, monotone `sans-serif`, monotone-serif `serif`.

### Reserved names

- `migrated-custom.json` — auto-created for migrated non-default legacy colours; never overwritten; discovery lists it like any other file.
- `rustic.json` … `monotone-serif.json` — the five seeds, recreated when missing.

A user file may shadow nothing: names ARE files, so a collision with a default is just a case-collision case handled by the deterministic rule below.

## Validation rules (strict → invalid → excluded + reported in `invalidNames`)

| # | Rule | Failure result |
|---|------|----------------|
| 1 | Regular file directly inside `themes/` (dirent type; links/reparse points never followed; entry names containing path separators or `..` rejected unread) | ignored silently (never a candidate), except symlinks which are reported in `invalidNames` |
| 2 | Name ends `.json`; not hidden (no leading `.`); not a directory/subdirectory | ignored silently (wrong-extension/invisible per spec Assumptions) |
| 3 | Size ≤ 1 MB (`MAX_THEME_FILE_BYTES = 1_000_000`) | invalid |
| 4 | Valid UTF-8 JSON object | invalid |
| 5 | `typeface`: string, 1–512 chars, no control characters | invalid |
| 6 | `light` AND `dark` present, each an object containing all six token keys as `^#[0-9a-fA-F]{6}$` strings | invalid (missing node or missing/bad token both reject whole file) |
| 7 | Stem length ≤ 100 chars (`MAX_THEME_NAME_LENGTH`) | invalid |

Case-insensitive duplicate stems: group by lowercased stem; winner = lexicographically smallest full file name (code-unit `<`); losers are appended to `invalidNames`. Never two identically named themes. Delivered list sorted by name ascending (code-unit). Discovery never throws past the module boundary per-file; a failing directory read surfaces to the handler as an error Result.

## Settings shape (`config.json` → `.settings`)

Changed fields:

- `editorTheme`: **string** — the selected theme name (file stem). Defaults to `'rustic'`. Validated by `isValidEditorThemeName`: printable, no path separators `/ \`, no control characters, 1–100 chars. A PRESENT invalid value in a `settings:update` patch is strictly rejected (like `fileOpenBehavior`). Resolution against discovered themes happens at read time; unresolved names trigger silent fallback+repair (below).
- `editorColors`: **removed** from `Settings`. Legacy values are tolerated on disk but read only by the migration step (raw config read), never acted on afterwards.
- `editorFont`: **removed** from `Settings`. Same tolerate-for-migration-only rule.

All other settings fields unchanged. Writes remain debounced atomic read-modify-write preserving sibling sections.

## Migration state transitions (startup, idempotent)

Given raw legacy `.settings.editorColors` that passes the six-token hex validation:

1. Colours + stored `editorFont` match a default's colours-and-choice combo exactly (case-insensitive hex; either monotone variant accepted) → rewrite `settings.editorTheme` to that stem via the normal atomic settings write. No new file. Re-running changes nothing further.
2. No match → create `migrated-custom.json` `{ typeface: fontStackFor(storedChoice), light: storedColours, dark: storedColours }` if absent (atomic, create-only), then repair the selection to `migrated-custom`.
3. Legacy colours absent/invalid → no-op (fresh configs and hand-edited junk never migrate anything).

Ordering at startup: ensure dir → seed missing defaults → migrate → (window/renderer fetches list; handler repairs unresolved selections).

## Fallback / emergency appearance (FR-001 exception, FR-013)

- Emergency definition (renderer constant, also the generic CSS layer's `var()` fallbacks): rustic palette + Inter stack under `data-editor-theme="default"`. Never listed, never selectable, used only when the stored name matches no delivered definition (including empty/all-invalid folder and the pre-fetch first paint).
- Repair (main, while handling `themes:list`): stored selection not among discovered names → persist `editorTheme: 'rustic'` through the authoritative store. Silent, idempotent, no dialog, no document-state impact.

## IPC payload (channel `themes:list`)

Request: none (empty invoke payload).

Response: `Result<EditorThemesList>` where

```ts
interface EditorThemeDefinition { name: string; typeface: string; light: EditorColors; dark: EditorColors }
interface EditorThemesList { themes: EditorThemeDefinition[]; invalidNames: string[] }
```

`EditorColors` is the existing six-token record type (ipc-contract.ts:153-160). Errors map through `toAppError`/`sanitizeError` (`IO` on directory failure); absolute paths never appear in messages.
