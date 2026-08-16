# Contract: Markdown Syntax Options

The settings schema and runtime reconfiguration contract for spec 030. No new IPC
channel — the six options reuse the existing `settings:get` / `settings:update` surface.

## Settings schema (six new boolean fields)

```ts
interface Settings {
  // … existing fields …
  hardBreaks: boolean      // default false
  strikethrough: boolean   // default true
  tables: boolean          // default true
  taskLists: boolean       // default true
  math: boolean            // default true
  autolink: boolean        // default true
}
```

Validation (main, `settingsFile.ts`): a **present** non-boolean value is rejected with
the typed `IO` result in `validateSettingsPatch` (never coerced), matching `fileOpenBehavior`
strictness. This is a deliberate tightening over the existing `spellcheckEnabled`/`explorerVisible`
booleans (which rely only on the tolerant merge) — a syntax toggle is a parse-behaviour
switch and must not be silently coerced (research R5). Disk-loaded values fall back
per-field to the default when invalid or missing (tolerance, FR-009/FR-013).

## `MarkdownSyntaxOptions` (runtime)

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

Derived from the six settings; the single source of truth for both the remark-pipeline
builder and the input-rule gate.

## Options → remark pipeline (pure, renderer)

```
buildRemarkProcessor(options) → RemarkParser
```

A custom `$remark` plugin (`markdownSyntaxRemark`) composes the individual GFM/math
extensions conditionally through `this.data()`. When a syntax is `false` its extension is
omitted, so the tokenizer never produces the node/mark. Footnote (not one of the six
options) is always enabled to preserve existing behaviour.

| Option | `true` | `false` |
|--------|--------|---------|
| `strikethrough` | `micromark-extension-gfm-strikethrough` + `mdast-util-gfm-strikethrough` (from/to) | omitted → `~~` literal text |
| `tables` | `micromark-extension-gfm-table` + `mdast-util-gfm-table` (from/to) | omitted → pipe lines literal |
| `taskLists` | `micromark-extension-gfm-task-list-item` + `mdast-util-gfm-task-list-item` (from/to) | omitted → `- [ ]` literal |
| `autolink` | `micromark-extension-gfm-autolink-literal` + `mdast-util-gfm-autolink-literal` (from/to) | omitted → URL literal text |
| `math` | `remark-math` (its micromark + mdast extensions) | omitted → `$…$` literal |
| `hardBreaks` | custom transform emits `break` `isInline:false` (visible break) | stock `remarkLineBreak` soft breaks (`isInline:true`) |

## Runtime reconfiguration (per live editor)

On a settings change, for each live instance, in order:

1. Capture `getMarkdown()` (the current raw markdown, using the still-current serializer)
   and the cursor/scroll (`CursorState`).
2. `editor.action(ctx => …)`: rebuild the remark processor with the new options and set
   `remarkCtx`; rebuild and set `parserCtx` and `serializerCtx` from the processor + the
   unchanged `schemaCtx`.
3. `replaceAll(capturedMarkdown)` — re-parses with the new `parserCtx` and dispatches one
   ordinary, undoable transaction (undo/redo history is added to, never cleared).
4. Re-apply cursor/scroll (best-effort: character offset + scrollTop clamped to the new doc).

Invariants:

- The schema never changes (no node/mark added or removed), so prior undo steps stay valid.
- Capture happens **before** the serializer swap (so a `~~x~~` in the doc serializes to
  `~~x~~` before the new parser re-interprets it as literal text).
- The re-parse's `markdownUpdated` emission is **suppressed** (like the source-view lock),
  so the store's `content`/`baseline`/`editorBaseline` and the document `dirty` flag are
  untouched, no `revision` bump occurs, and no file write occurs.
- Source view is immune: it renders `document.content` verbatim and is not reconfigured.

## Input-rule gate

The syntax-producing input rules (`~~`, `- [ ]`, table, math `$`) consult
`MarkdownSyntaxOptions`; a rule for a disabled syntax returns `false` and does nothing.
Enabled syntaxes behave exactly as today.

## Settings dialog

- Sidebar gains `Markdown` (third entry, after `General` and `Theme`).
- The Markdown panel shows six `settings-switch` pill controls (FR-009), one per option,
  labelled:
  - `Convert single line breaks to hard breaks`
  - `Strikethrough formatting (~~text~~)`
  - `Tables formatting (| column |)`
  - `Task list checkboxes (- [ ] / - [x])`
  - `Math and LaTeX expressions ($...$ and $$...$$)`
  - `Automatic link detection for URLs and emails`
- Each toggles immediately (no Save gating), matching the spellcheck switch.

## Verification

- Unit (`tests/main/settings.test.ts`): six-field validation — valid booleans accepted;
  present non-boolean rejected with `IO` in `validateSettingsPatch`; missing/invalid on
  disk → default (per-field tolerance).
- Unit (`tests/renderer/markdownSyntaxOptions.test.ts`): the options→extension-composition
  matrix — every on/off combination includes/excludes the correct micromark + mdast
  extensions; `hardBreaks` flips soft↔hard break emission.
- Unit (`tests/renderer/useSettingsState.test.tsx`): the six `handle*Change` handlers
  update local state, persist via `updateSettings`, and fan out to `markdownSyntaxRuntime`.
- e2e (`tests/e2e/markdown-syntax-options.spec.ts`):
  - dialog shows the six toggles; each toggle switches rendering in an open tab;
  - **multi-tab sync** (US3): two open tabs both re-render; dirty dot, unsaved edits,
    undo/redo, cursor and scroll survive (US3 S1/S2/S3);
  - hard-break toggle re-flows paragraphs (US2);
  - settings survive restart (US4); fresh install → FR-013 defaults;
  - round-trip both directions: disabled syntax saves exact bytes, and enabling a syntax
    present in the raw file does not rewrite it on save (SC-004);
  - source view is unaffected; unclosed `~`/`$` stays literal in both states; rapid
    toggling settles on the final state.

SC-002 (≤ 300 ms) is a design/performance goal asserted by manual verification, not a
flaky e2e timing assertion. SC-005 (usability < 10 s) is a manual evaluation item, not
automatable.
