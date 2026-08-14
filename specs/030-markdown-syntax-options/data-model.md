# Data Model: Markdown Syntax and Formatting Options

## Persisted Settings

The existing `config.json` shape remains `{ recentItems?: RecentItem[], settings?: Settings }`.
Six flat boolean fields are added to `Settings` (spec Key Entities name them exactly);
each falls back independently to its default when missing or invalid, and writes remain
atomic through `writeSettingsFile`.

| Field | Type | Default | Validation | Controls |
|-------|------|---------|------------|----------|
| `hardBreaks` | `boolean` | `false` | boolean (main) | single newline → soft (`false`) or hard (`true`) break |
| `strikethrough` | `boolean` | `true` | boolean (main) | `~~text~~` |
| `tables` | `boolean` | `true` | boolean (main) | `\| col \|` pipe tables |
| `taskLists` | `boolean` | `true` | boolean (main) | `- [ ]` / `- [x]` |
| `math` | `boolean` | `true` | boolean (main) | `$…$` and `$$…$$` |
| `autolink` | `boolean` | `true` | boolean (main) | raw URL/email auto-linking |

For `settings:update`, a present field whose value is not a boolean is rejected with the
existing typed `IO` result (never silently coerced). The disk-loaded path stays tolerant
per-field (a partially corrupt config recovers every other field).

## Markdown Syntax Options (spec "Key Entities")

The in-session runtime value derived from the six settings, consumed by the editor. A
plain object of the same six booleans; it is the single source of truth the remark
pipeline builder and the input-rule gate both consult.

```ts
interface MarkdownSyntaxOptions {
  hardBreaks: boolean
  strikethrough: boolean
  tables: boolean
  taskLists: boolean
  math: boolean
  autolink: boolean
}
```

Defaults (FR-013): `{ false, true, true, true, true, true }`.

## Syntax Extension → remark mapping

| Option | On (`true`) | Off (`false`) |
|--------|-------------|---------------|
| `strikethrough` | `micromark-extension-gfm-strikethrough` + `mdast-util-gfm-strikethrough` parse `~~text~~` into a strike mark | extension omitted → `~~` stays literal text |
| `tables` | `micromark-extension-gfm-table` + `mdast-util-gfm-table` parse pipe tables | extension omitted → pipe lines stay literal |
| `taskLists` | `micromark-extension-gfm-task-list-item` + `mdast-util-gfm-task-list-item` parse `- [ ]` | extension omitted → brackets stay literal |
| `math` | `remark-math` parses `$…$`/`$$…$$` into latex nodes | `remark-math` omitted → dollar signs stay literal |
| `autolink` | `micromark-extension-gfm-autolink-literal` + `mdast-util-gfm-autolink-literal` parse bare URLs/emails | extension omitted → URLs stay plain text |
| `hardBreaks` | custom remark transform emits `break` `isInline:false` (visible line break) | soft breaks: `break` `isInline:true` (renders as a space) |

Footnote (not one of the six options) is always enabled to preserve existing behaviour.

The schema (nodes/marks) is identical in both states — only the remark pipeline changes.
This is what keeps the undo stack valid across a toggle (research R1/R3).

## Line Break Mode (spec "Key Entities")

`hardBreaks` is the sole field. `false` = standard CommonMark soft breaks (single newline
collapses to a space); `true` = every single return produces a visible line break within
the same paragraph block.

## State transitions

- **Toggle in the dialog** (US1/US2/US3): update the local `MarkdownSyntaxOptions`, persist
  via `settings:update`, and reconfigure each live editor in place. The store's document
  `dirty`/`baseline`/`editorBaseline` are untouched; the re-parse consumes the same raw
  markdown, so no byte is written and no save is triggered.
- **Startup** (US4): `loadSettings()` restores the six fields; missing/unreadable config
  yields the FR-013 defaults (settingsFile.ts tolerance).
- **Disabled syntax on save** (Edge Case): saving writes the exact raw source text; the
  serializer under the disabled option must reproduce the literal delimiters verbatim
  (round-trip is covered by SC-004).

## Settings Area

A third sidebar entry `markdown` is added beside `general` and `theme` (display label
`Markdown`):

| Area | Initial state | Contents | Persistence model |
|------|---------------|----------|-------------------|
| `general` | — | Spellcheck, file-opening preference | Immediate |
| `theme` | — | App theme, editor theme | App immediate; editor Save-gated |
| `markdown` | not auto-selected (dialog mounts on `general`) | six `settings-switch` pill toggles | Immediate |
