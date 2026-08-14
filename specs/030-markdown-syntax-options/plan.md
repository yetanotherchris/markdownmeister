# Implementation Plan: Markdown Syntax and Formatting Options

**Branch**: `030-markdown-syntax-options` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-markdown-syntax-options/spec.md`

## Summary

The settings dialog gains a **Markdown** area with six independent boolean toggles
that control which optional markdown syntaxes the WYSIWYG editor recognizes:
hard line breaks, strikethrough, tables, task lists, math expressions, and
automatic link detection (FR-001…FR-009). Changes apply immediately to every open
tab without discarding unsaved edits, undo/redo history, cursor, or scroll
(FR-010/011), and persist across restarts with the defaults specified in FR-013.

The six options do **not** map 1:1 onto Crepe's `CrepeFeature` set, and — critically
— they cannot be driven by `remark-gfm` options, because `remark-gfm@4.0.1` exposes
no per-syntax off-switches (research R1). Instead, a single custom remark plugin
composes the *individual* GFM/math extensions conditionally (the
`micromark-extension-gfm-*` / `mdast-util-gfm-*` packages already shipped as
transitive dependencies). The schema (nodes/marks) is kept constant; only the remark
pipeline that *parses* and *serializes* is reconfigured at runtime, then each live
editor re-parses its current markdown through Milkdown's own `replaceAll` macro — an
ordinary, undoable transaction that does not clear history.

## Technical Context

**Language/Version**: TypeScript 5.8, `strict: true`, across main, preload, and renderer.

**Primary Dependencies**: React 19, `@milkdown/crepe` 7.21.3 / `@milkdown/kit` 7.21.3,
`@milkdown/core` (exported slices). The conditional composer imports the individual
GFM packages `micromark-extension-gfm-{strikethrough,table,task-list-item,autolink-literal}`
and `mdast-util-gfm-{strikethrough,table,task-list-item,autolink-literal}` (plus
`remark-math`) directly, so these are promoted from transitive to direct dependencies —
no *new* code ships (they are already in the bundle via `remark-gfm`/`remark-math`).
Hard-break behaviour reuses Milkdown's `hardbreak` node (research R2).

**Storage**: `config.json` `settings` gains six boolean fields (`hardBreaks`,
`strikethrough`, `tables`, `taskLists`, `math`, `autolink`). Same read-modify-write,
atomic, `0o600` settings store as the rest.

**Testing**: Vitest (settings validation, the pure `markdownSyntaxOptions` mapping and
remark-pipeline builder); Playwright e2e (toggling in the dialog changes rendering in
open tabs, persistence across restart, source-view immunity, save round-trip).

**Target Platform**: Windows, macOS, Linux desktop.

**Project Type**: Desktop application (Electron), WYSIWYG markdown editor.

**Performance Goals**: SC-002 — any setting change updates all open tabs within
300 ms. Reconfiguration is a remark-processor rebuild + one `replaceAll` per live
instance; both are sub-frame for the bounded pool (≤ 8 instances).

**Constraints**: FR-011 — no discard of unsaved edits, undo/redo, cursor, or scroll.
FR-014/015 — disabled syntax must render as literal text, enabled syntax must parse
into rich elements. Schema must stay constant so the undo stack is never invalidated
by a node/mark type disappearing mid-session (research R1/R3).

**Scale/Scope**: one shared contract type + six settings fields + validation; one pure
module for the options→remark-pipeline mapping; a runtime reconfiguration path in the
editor host; the settings-dialog Markdown area; unit + e2e coverage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Process Isolation Is Absolute | No new IPC channel; settings reuse the existing named `settings:update`/`settings:get`. Renderer stays sandboxed | **PASS** |
| II. Every Path Is Untrusted | No filesystem or path handling touched | **PASS** |
| III. Never Lose The User's Words | Reconfiguration re-parses the *same* raw markdown via an undoable transaction; store dirty state untouched; no file write occurs | **PASS** |
| IV. Calm, Predictable Editing | No keystroke-path work; reconfiguration happens only on an explicit settings change, off the typing path | **PASS** |
| V. Test What Can Corrupt Or Escape | Settings validation (strict + tolerant) and the options→extension-composition matrix get unit tests; round-trip (disabled **and enabled** syntax saves exact bytes, SC-004) gets e2e coverage | **PASS** |

**Post-design re-check**: no principle is violated.

## Phase 1 Design decisions

**Six flat boolean settings fields.** `Settings` gains `hardBreaks`, `strikethrough`,
`tables`, `taskLists`, `math`, `autolink` (all `boolean`, defaults per FR-013:
`false`, `true`, `true`, `true`, `true`, `true`). Flat, matching the existing
`spellcheckEnabled` pattern; validated in main like every other boolean field.

**Options→pipeline mapping (pure module).** A new `markdownSyntaxOptions.ts` maps the
six booleans to a remark-plugin composition: for each enabled GFM syntax it includes the
corresponding micromark + mdast from/to-markdown extensions; it includes `remark-math`
when `math` is on; and it selects soft (`isInline:true`, stock `remarkLineBreak`) vs hard
(`isInline:false`) break emission for `hardBreaks`. A custom `$remark` plugin
(`markdownSyntaxRemark`) applies this subset through `this.data()` so disabled syntaxes
are never tokenized. The stock `remark-gfm` (and its bundled footnote, which is out of
scope and stays enabled) is subsumed by this composer.

**Runtime reconfiguration, not recreation.** On a settings change, each live editor
rebuilds its `remark` processor and parser/serializer slices through `editor.action`
(using the exported `remarkCtx`/`parserCtx`/`serializerCtx` from `@milkdown/core`),
captures `getMarkdown()` **before** swapping the serializer, then calls Milkdown's
`replaceAll(captured)` — which reads the freshly reconfigured `parserCtx` and dispatches
one undoable transaction. The `markdownUpdated` emission caused by the re-parse is
suppressed (mirroring the existing source-view lock) so the store's
`content`/`baseline`/`editorBaseline`/`dirty` and any in-flight save's `revision` guard
are untouched. Cursor and scroll are captured before and re-applied after (best-effort
character offset + scrollTop, research R6). This keeps the schema — and therefore the
undo stack — stable while changing only parsing behaviour (research R1/R3).

**Input-rule gating.** The syntax-producing input rules (`~~`, `- [ ]`, table, math `$`)
are gated by the same runtime options so typing a disabled syntax never auto-formats it,
via flag-checking wrappers whose handler returns `false` when the option is off
(research R4).

**Settings dialog Markdown area.** A third sidebar entry `Markdown` (alongside `General`
and `Theme`) renders six `settings-switch` pill controls, applied immediately on toggle.
This requires changing the dialog's `area === 'general' ? … : …` binary into a three-way
dispatch so `markdown` renders its own panel. The six handlers in `useSettingsState`
persist via the existing `updateSettings` → `window.api.updateSettings` path and also fan
out to `markdownSyntaxRuntime.reconfigureAll` so every live editor re-parses (research R6).

## Project Structure

### Documentation (this feature)

```text
specs/030-markdown-syntax-options/
├── spec.md              # Requirements
├── plan.md              # This file
├── research.md          # R1…R5 decisions
├── data-model.md        # Markdown Syntax Options entity + settings fields
├── quickstart.md        # Manual verification script
├── contracts/
│   └── markdown-syntax.md  # settings schema + runtime reconfiguration contract
└── tasks.md             # (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/shared/ipc-contract.ts                  # six Settings fields (+ type)
src/main/settingsFile.ts                    # DEFAULTS, validateSettings, mergeSettingsPatch, AND validateSettingsPatch
src/renderer/state/settings.ts              # renderer cache: the six fields + defaults (mirrors main DEFAULTS)
src/renderer/editor/markdownSyntaxOptions.ts # NEW: options type + conditional GFM/math composer + defaults
src/renderer/editor/markdownSyntaxRuntime.ts # NEW: reconfigureAll(instancePool, options) — swap slices + replaceAll + cursor/scroll
src/renderer/editor/CrepeHost.tsx           # build the conditional remark pipeline at create; suppress re-parse emission
src/renderer/editor/EditorPanel.tsx         # pass markdown options down / trigger reconfig
src/renderer/chrome/SettingsDialog.tsx      # Markdown area (6 pill switches) + three-way area dispatch
src/renderer/hooks/useSettingsState.ts      # six settings state + handlers (fan out to markdownSyntaxRuntime)
src/renderer/App.tsx                        # plumb markdown options into the editor panel
tests/main/settings.test.ts                 # six-field validation cases (validateSettingsPatch strict + disk tolerance)
tests/renderer/markdownSyntaxOptions.test.ts # NEW: options→extension-composition matrix
tests/renderer/useSettingsState.test.tsx    # NEW/EXTEND: six markdown handlers
tests/e2e/markdown-syntax-options.spec.ts   # NEW: toggle → rendering, multi-tab sync, persistence, source view, save
```

**Structure decision**: the pure options→pipeline mapping lives beside the editor
(mirroring `editorThemePresets.ts`); the runtime reconfiguration lives in a small
module beside `CrepeHost.tsx`; the dialog area and settings plumbing follow the
existing `useSettingsState`/`SettingsDialog` pattern.

## Phase status

- Phase 1: Foundational — contract + six settings fields + validation + options module
- Phase 2: US1+US2 — runtime reconfiguration in the editor host + dialog Markdown area
- Phase 3: US3+US4 — multi-tab immediate apply + persistence + defaults
- Phase 4: Verification — unit + e2e
- Phase 5: Polish — gates, spec archive, status table

## Deferred / later features

- Additional markdown extensions beyond the six (spec Assumptions: explicitly future)
- Per-document (rather than global) syntax overrides

## Complexity tracking

None — no principle violated. The runtime reconfiguration reuses Milkdown's exported
slices and its own `replaceAll` macro; no recreation, no schema change, no new IPC.
