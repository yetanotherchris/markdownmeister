# Research: Markdown Syntax and Formatting Options

## R1 — The six options map onto the *remark pipeline*, not `CrepeFeature`; `remark-gfm` cannot be configured per-syntax

**Decision**: treat the six options as *parsing/serialization* concerns driven by a single
custom remark plugin that composes the individual GFM/math extensions conditionally. The
stock `remark-gfm` plugin is **not** used as the per-syntax control, because it has no
per-syntax off-switches.

| Option | Default | Mechanism (custom `markdownSyntaxRemark` composer) |
|--------|---------|---------------------------------------------------|
| `hardBreaks` | `false` | custom remark transform emitting `break` nodes `isInline:false` (hard) when on; the stock `remarkLineBreak` soft-break behaviour (`isInline:true`) when off |
| `strikethrough` | `true` | include `micromark-extension-gfm-strikethrough` + `mdast-util-gfm-strikethrough` (from/to-markdown) |
| `tables` | `true` | include `micromark-extension-gfm-table` + `mdast-util-gfm-table` (from/to-markdown) |
| `taskLists` | `true` | include `micromark-extension-gfm-task-list-item` + `mdast-util-gfm-task-list-item` (from/to-markdown) |
| `math` | `true` | include `remark-math` (its micromark + mdast extensions) |
| `autolink` | `true` | include `micromark-extension-gfm-autolink-literal` + `mdast-util-gfm-autolink-literal` (from/to-markdown) |

**Rationale**: I read the published types and compiled sources rather than assume.
`CrepeFeature` (`@milkdown/crepe/lib/types/feature/index.d.ts`) is the closed set
`CodeMirror | ListItem | LinkTooltip | Cursor | ImageBlock | BlockEdit | Toolbar |
Placeholder | Table | Latex | TopBar | AI` — only `Latex` corresponds to a spec option
(math), and the `Table` feature is the insert/edit-table UI, not GFM pipe-table parsing.

The decisive correction: `remark-gfm@4.0.1` exposes **no** per-syntax toggle. Its
`Options` (`remark-gfm/index.d.ts`) is only `MicromarkOptions ∪ MdastOptions`, i.e.
`singleTilde` (strikethrough parse), and `firstLineBlank`, `stringLength`,
`tableCellPadding`, `tablePipeAlign` (serialization). There is no way to turn off
strikethrough, tables, task lists, or autolinking through its options. The individual
extensions it composes, however, are all present in `node_modules` as transitive
dependencies and expose exactly the granular pieces needed:
`micromark-extension-gfm-{strikethrough,table,task-list-item,autolink-literal}` (syntax)
and `mdast-util-gfm-{strikethrough,table,task-list-item,autolink-literal}`
(from/to-markdown), each verified by reading their `index.d.ts`. So a custom remark
plugin can compose only the enabled subset.

**Alternatives considered**: per-syntax `remark-gfm` options (rejected — they do not
exist); toggling whole Milkdown presets (rejected — the GFM preset bundles all four
GFM syntaxes plus footnote, so per-syntax control is impossible at preset granularity);
a post-parse "undo" plugin that re-serializes disabled nodes back to literal delimiters
(rejected — reconstructing table/`~~` delimiters is lossy and breaks round-trip).

## R2 — Hard breaks reuse Milkdown's `hardbreak` node; soft vs hard is a `break` node attr

**Decision**: no new dependency. Milkdown's `remarkLineBreak`
(`@milkdown/preset-commonmark/src/plugin/remark-line-break.ts`) converts single newlines
into `break` nodes with `isInline:true`; the `hardbreak` schema
(`src/node/hardbreak.ts`) renders `isInline:true` as a space (soft) and `isInline:false`
as `<br>` (hard), serializing to `\n` vs a hard break. A small custom remark transform,
active only when `hardBreaks` is on, emits `isInline:false` for single newlines; when off
the stock `remarkLineBreak` soft-break behaviour applies. The `hardbreak` node is always
in the schema, so the toggle never changes the schema.

**Rationale**: matches US2 exactly (single newline collapses to a space when off, becomes
a visible line break when on) and keeps the schema constant (R1's core requirement).

**Alternatives considered**: `remark-breaks` (rejected — new dependency with a different
AST shape than Milkdown's `hardbreak` node); CSS-only (rejected — the delimiters are not
characters in the doc, and the spec needs a real line-break node for round-tripping).

## R3 — Runtime reconfiguration via Milkdown's exported slices + its own `replaceAll`

**Decision**: reconfigure the remark processor and parser/serializer slices in place, then
re-parse each live editor's current markdown with Milkdown's `replaceAll` macro. The schema
(nodes/marks) never changes.

**Rationale**: the source of truth is the raw markdown; a toggle changes only how it is
*interpreted*. Milkdown builds its parser once at init (`parser` plugin:
`ParserState.create(schema, remark)`) and its `replaceAll` macro reads `ctx.get(parserCtx)`
fresh on every call (`@milkdown/utils/src/macro/replace-all.ts`), dispatching
`state.tr.replace(0, size, …)` — an **ordinary, undoable** transaction (no
`addToHistory:false`; Milkdown's history is plain prosemirror-history). The slices are all
exported from `@milkdown/core` (`remarkCtx`, `remarkPluginsCtx`, `parserCtx`,
`serializerCtx`, `schemaCtx` — verified in `internal-plugin/*.d.ts`). On a toggle, via
`editor.action`, we rebuild `remarkCtx` with the conditional composer (R1/R2), rebuild
`parserCtx`/`serializerCtx` from the unchanged `schemaCtx`, then `replaceAll(getMarkdown())`.

Two ordering/subtlety requirements this imposes:
- **Capture before swap**: `getMarkdown()` must be read while the OLD serializer (with the
  syntax still enabled) is in effect, so a `~~x~~` in the doc serializes to `~~x~~` before
  the new parser re-interprets it as literal text.
- **Suppress the resulting emission**: the re-parse fires the `markdownUpdated` listener,
  which would route `UPDATE_CONTENT` and recompute the store's `dirty`/`revision`. The
  reconfiguration must drop that emission (like the source-view lock already does in
  `CrepeHost.tsx`), so the store's `content`/`baseline`/`editorBaseline`/`dirty` and any
  in-flight save's `revision` guard are genuinely untouched.

Keeping the schema constant means no node/mark type disappears mid-session, so prior undo
step-maps stay valid. Removing a mark/node at runtime would invalidate the undo stack —
the exact integrity hazard FR-011 forbids.

**Alternatives considered**: destroy/recreate each editor (rejected — clears undo, loses
cursor/scroll); change only remark options without re-parsing (rejected — already-parsed
content keeps its rich structure, violating FR-014); drop schema types on toggle
(rejected — invalidates undo, R1).

## R4 — Input rules must be gated by the same options

**Decision**: the syntax-producing input rules (strikethrough `~~`, task list `- [ ]`,
table, math `$`) are gated by the runtime options: each gated rule is replaced with a
flag-checking wrapper whose handler returns `false` when its option is off.

**Rationale**: FR-014 ("MUST NOT format or transform") and US1 S3 ("types or views text
enclosed in double tildes") cover typing, not just loading. The GFM/LaTeX input rules are
ProseMirror `InputRule`s registered through `inputRulesCtx`; they fire independently of
the remark parser, so reconfiguring parsing alone would still let typing `~~x~~` wrap a
strike mark when strikethrough is disabled. Wrapping the handlers against a shared runtime
options module makes the parser and the typing path consult the same truth.

**Alternatives considered**: re-registering the whole `inputRulesCtx` list per toggle
(rejected — more churn for the same result); post-parse normalization (rejected — the rule
would already have created the node/mark, contradicting FR-014).

## R5 — Settings plumbing reuses the existing apply-immediately + persist path

**Decision**: the six options are six flat `boolean` settings fields (`hardBreaks`,
`strikethrough`, `tables`, `taskLists`, `math`, `autolink`), driven through the existing
`useSettingsState` → `updateSettings` → `window.api.updateSettings` chain with immediate
application.

**Rationale**: the spec's Key Entities name these exact fields, and `spellcheckEnabled`
already demonstrates the required apply-immediately + debounced-atomic-persist +
startup-restore model. Six flat booleans avoid a nested `markdown` object that would
diverge from the flat config shape and need its own migration/validation branch.

**Strictness decision**: the six booleans are **strictly validated** in
`validateSettingsPatch` (a present non-boolean is rejected with the typed `IO` result,
like `fileOpenBehavior`), while the disk-loaded path (`validateSettings`) stays tolerant
per-field. This is deliberately stricter than the existing `spellcheckEnabled`/`explorerVisible`
booleans (which rely only on the tolerant merge), because a syntax toggle is a parse-behaviour
switch whose corruption should never be silently coerced. The deviation is recorded here
and in the contract, not just in code.

**Alternatives considered**: nested `settings.markdown = { … }` (rejected — flat config,
extra migration); a separate config file (rejected — FR-012 says the per-user config store);
tolerant-only handling like `spellcheckEnabled` (rejected — see strictness decision above).

## R6 — Reconfiguration trigger and cursor/scroll mapping

**Decision**: the six handlers in `useSettingsState` additionally fan out to a
`markdownSyntaxRuntime.reconfigureAll(instancePool, options)` call (a new module) so every
live editor re-parses on change; the settings update itself still flows through
`window.api.updateSettings`. Cursor/scroll are captured before and re-applied after each
`replaceAll`, using the existing `CursorState` (offset + scrollTop), clamped to the new doc
size; the numeric offset is accepted as a best-effort restoration — a full-doc re-parse
shifts node granularity, so the guarantee is "same character offset and viewport", not
"same semantic node".

**Rationale**: the existing `handleSpellcheckChange` pattern ends at the IPC call; the
markdown options need an extra side channel to the live editors. `instancePool` already
tracks every live `Crepe`, giving a natural fan-out point. The cursor/scroll caveat is
stated explicitly so FR-011's "cursor/scroll preserved" claim is not overstated.

**Alternatives considered**: an effect in `App.tsx` observing the six values (rejected —
spreads reconfiguration policy into the composition root); full semantic position mapping
through the `replaceAll` step map (rejected — brittle and disproportionate; character
offset + scrollTop matches what the app already does for tab switches).
