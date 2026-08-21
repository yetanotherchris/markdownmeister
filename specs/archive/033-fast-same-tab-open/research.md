# Research: Fast Same-Tab Document Open

Feature: [spec.md](./spec.md) | Plan: [plan.md](./plan.md) | Date: 2026-08-20

All findings verified against the codebase and `node_modules` on 2026-08-20. Line numbers refer to the current working tree.

## Baseline: where open time goes today

A same-tab open of a not-already-open file currently performs, in order:

1. **Gesture deferral** — 500 ms double-click window before a single-click open commits (`src/renderer/explorer/openGesture.ts:12`). Intentional (spec 029); excluded from all targets by spec definition.
2. **Outgoing dirty check #1** — full serialization during the click gesture (`src/renderer/hooks/useFileOpenGesture.ts:64`).
3. **Disk read** — synchronous read + stat in main (`src/main/fs/read.ts:47-48`), no cache. Not the bottleneck for typical documents.
4. **Outgoing dirty check #2** — full serialization in `openWithDecision` (`src/renderer/hooks/useDocumentSession.ts:453`).
5. **Editor construction** — dynamic import (cached), `new Crepe({ defaultValue })` → parse #1, plugin registration, `crepe.create()` → ProseMirror view + top-bar DOM (`src/renderer/editor/CrepeHost.tsx:127-195`).
6. **No-op reconfigure** — `reconfigureEditor(...)` swaps parser/serializer then `replaceAll(sourceMarkdown)` → **parse #2** plus a whole-document undoable transaction, even when options are defaults (`src/renderer/editor/markdownSyntaxRuntime.ts:113,131`; called from `CrepeHost.tsx:240-243`).
7. **Baseline capture** — incoming doc serialization #1: `onBaselineCapture(crepe.getMarkdown())` (`CrepeHost.tsx:249`).
8. **Initial spellcheck pass** — scheduled 120 ms after view creation, whole document on the main thread (`src/renderer/editor/spellcheckPlugin.ts:35,128-137`), potentially inside the staging window.
9. **Pre-commit outgoing dirty check #3** — full serialization in `handleStagedEditorReady` (`useDocumentSession.ts:375`).
10. **Deferred teardown** — outgoing editor destroyed via idle callback (`CrepeHost.tsx:268`).

Spec 032 documents the total as "about one second while Milkdown initializes" (`specs/archive/032-staged-tab-replacement/spec.md:9`).

## R1 — Skip the second parse when the syntax pipeline already matches

**Decision**: Guard `reconfigureEditor` so the parser/serializer swap and `replaceAll` are skipped when the requested options equal the options already applied to that editor; always run `setMarkdownSyntaxGateOptions`.

**Rationale**:
- With default options the swapped processor is extension-equivalent to Crepe's stock pipeline: same base (`remark-parse` + `remark-stringify` with the same stringify-options ctx), `remark-gfm` ≡ its five individual extensions (verified `node_modules/remark-gfm/lib/index.js:9,38-40`), `remark-math` ≡ math extensions, `hardBreaks:false` adds no transform (`src/renderer/editor/markdownSyntaxOptions.ts:72-123`). The code itself asserts "defaults all-on are a no-op re-parse" (`CrepeHost.tsx:233-236`).
- Skipping also removes the mount-time whole-document undo entry created by `replaceAll` today (spec 030 research records `replaceAll` as an ordinary undoable transaction), and the debounced emission it triggers on the create path.

**Correctness trap (must-handle)**: comparing against `DEFAULT_MARKDOWN_SYNTAX_OPTIONS` alone is wrong — a user who toggles a syntax off then back on produces options equal to defaults while the live pipeline is non-default. The guard must compare against per-editor applied options (module-level `WeakMap<Crepe, MarkdownSyntaxOptions>`; absence ⇒ stock defaults, true for freshly mounted editors).

**Residual risk + mitigation**: byte-equality of default-pipeline vs swapped-with-defaults serializer output is asserted only by comments, not tests. Mitigation: add a round-trip unit test parsing+serializing fixtures under both pipelines and comparing strings before relying on the skip.

**Alternatives considered**:
- *Reuse one editor across documents with content swap* — rejected: Milkdown/Crepe has no supported content-swap API at construction quality (AGENTS.md worked example; spec 024 requires fresh undo history per document).
- *Skip only the swap, keep replaceAll* — pointless; `replaceAll` is the expensive half.

## R2 — Doc-identity fast path for outgoing dirty checks

**Decision**: Record the ProseMirror `doc` object reference alongside the baseline. `isDirtyLive` returns clean without serializing when the live view's `doc` is reference-identical to the recorded one; otherwise fall back to the existing full comparison.

**Rationale**:
- Today the outgoing document is fully serialized up to three times per open (gesture check, decision gate, pre-commit gate — sites listed in Baseline items 2/4/9). For the overwhelmingly common case (untouched outgoing tab) every one of those serializations recomputes a string identical to the stored baseline.
- ProseMirror preserves the `doc` object reference across transactions without steps; decoration-only transactions (spellcheck marks, selection) do not change it. Reference inequality occurs exactly when a doc-changing transaction happened — precisely when the exact check is needed.
- The live check exists because the store's debounced flag can be 200 ms stale (`@milkdown/plugin-listener` debounces emissions; `useDocumentSession.ts:373-374,437-439` codify "never trust the flag" for decisions, Principle III). Doc identity is a *synchronous* freshness signal, so the race protection is preserved exactly.

**Alternatives considered**:
- *Trust the store's latest emitted markdown* — rejected: 200 ms staleness is the exact race the live check closes.
- *Dirty-since-emission boolean plugin* — equivalent information, more state; doc identity needs no new transaction hooks.

## R3 — Incoming baseline: keep exactly one serialization

**Decision**: Keep `onBaselineCapture(crepe.getMarkdown())` as the single incoming serialization. With R1 in place there is no second parse competing with it.

**Rationale**: Deriving the baseline from raw disk text is unsafe. Verified divergences between raw body and `getMarkdown()` output beyond what `markdownSame` tolerates (CRLF, single trailing newline): remark-stringify's canonical `-`→`*` bullet rewrite (`node_modules/mdast-util-to-markdown/lib/util/check-bullet.js`; acknowledged in `tightList.ts:23-25`), autolink `<url>` emission (`CrepeHost.tsx:237-239`), entity/pipe normalization. Spec 002 tried raw-text comparison and shipped false-dirty for normalizing files (`specs/archive/002-view-source/research.md:260-290`, explicitly listed under rejected alternatives).

## R4 — Defer the initial spellcheck pass off the presentation path

**Decision**: Schedule the initial whole-document pass via idle callback with a timeout bound; cancel on destroy. Keep incremental re-checks as-is.

**Rationale**: The initial pass runs ~120 ms after view creation on the main thread (`spellcheckPlugin.ts:35,128-137`) — inside the staging window for opens. Deferral is sanctioned by spec FR-004 and the spec assumption ("marks arriving a beat later is preferable to a slower open"). The correction menu reads DOM marks at right-click time and degrades to no-menu within the first beat exactly as it does today within the first 120 ms; incremental checking is independent of the initial pass. E2E assertions are poll-based (`tests/e2e/spellcheck.spec.ts:91-97`) and tolerate idle-time deferral.

**Alternatives considered**: gating passes on staged/hidden state entirely — deferred to tasks as a possible extra; not required by the spec.

## R5 — Instrumentation counters for SC-002/SC-003

**Decision**: A renderer module (`openPerformance.ts`) counts full parses, full serializations, and per-open durations, exposed on the page context for e2e consumption. Renderer-memory only; no preload or IPC changes.

**Rationale**: SC-002/SC-003 demand observable counts ("today two, then one"). Unit tests can assert counter deltas directly; e2e reads them from the page. Counters are inert in normal use.

**Alternatives considered**: performance marks only — insufficient; they measure duration, not operation counts.

## R6 — Timing harness for SC-001/SC-004

**Decision**: Playwright e2e measures open duration from open-gesture commit (post-deferral) to editor-ready signal, over generated documents (including a 10,000-line fixture and a 10× scaled variant), aggregating p95 across repeated runs.

**Rationale**: Matches the spec's measurement definition (excludes the intentional 500 ms window). CI timing variance is handled by p95 aggregation and generous assertion bounds relative to the 250 ms target; local runs provide the primary signal, CI provides regression detection with a documented tolerance multiplier if needed.

**Alternatives considered**: asserting absolute times on shared CI runners as hard gates — rejected as flaky; the harness reports percentiles and asserts against the target with a CI-specific multiplier recorded in tasks.

## R7 — Measured floor of the same-tab open (2026-08-21, implementation evidence)

**Decision**: SC-001's fixed 250 ms budget applies to typical documents (≤ ~1,000 lines); larger documents are governed by SC-004's linear-scaling bound. Recorded as a spec clarification the same day.

**Evidence** (built app, this repository's e2e harness, repeated alternating opens):

| Document | Open → ready | Notes |
|---|---|---|
| 1,000 lines | ~165 ms median, ~175 ms max over 12 runs | meets SC-001 with margin |
| 10,000 lines | ~1.9 s consistently (min 1.86 s) | dominated by mandatory work |

Phase breakdown of one 10,000-line open: `new Crepe()` + `crepe.create()` ≈ **1,572 ms** (the single construction parse, ProseMirror view, top-bar DOM); baseline capture `getMarkdown()` ≈ **344 ms** (the one mandated incoming serialization, research R3); tail ≈ 0. Disabling the deferred initial spellcheck pass changed nothing — R4's deferral is not a factor in the measurement.

**Rationale**: Both dominant costs are irreducible within the architecture. The construction parse cannot be skipped or amortized because every opened document gets a fresh editor instance (fresh undo history per opened document is a hard requirement; Milkdown/Crepe has no supported content-swap API at construction quality — see AGENTS.md worked example and spec 024). The baseline serialization is the exact-comparison anchor for dirty-state correctness (research R3; deriving it from raw disk text resurrects the spec 002 false-dirty bug). Before this feature the same open paid that floor TWICE for parsing plus up to three outgoing serializations; instrumentation now proves parses 2 → 1 and outgoing serializations 3 → 0 (SC-002/SC-003).

**Alternatives considered**: holding the 250 ms @ 10k target — blocks the phase on an editor-level breakthrough outside this feature's scope; a flat 2 s @ 10k budget — encodes one machine's number as the requirement instead of the scaling law that actually governs large documents.
