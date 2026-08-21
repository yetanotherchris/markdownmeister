# Tasks: Fast Same-Tab Document Open

Feature: [spec.md](./spec.md) | Plan: [plan.md](./plan.md) | Contracts: [contracts/open-performance.md](./contracts/open-performance.md)

Tests: unit tests live in `tests/renderer/` (Vitest), e2e in `tests/e2e/` (Playwright against the built app). Every task that changes behaviour names its test. All tasks are renderer-only; no IPC, preload, or filesystem surface changes.

## Phase 1 — Instrumentation foundation (R5, contract C4)

- [x] **T001** Create `src/renderer/editor/openPerformance.ts`: resettable counters (`fullParses`, `fullSerializations`, `outgoingSerializations`, `openDurations[]`) with `recordParse()`, `recordIncomingSerialization()`, `recordOutgoingSerialization()`, `beginOpen()`, `endOpen()` (duration only recorded when a start is pending; latest start wins on supersede), `resetOpenPerformanceCounters()`, and a read-only `getOpenPerformanceCounters()` snapshot exposed on the renderer `window` as `__mmOpenPerformance` for e2e reads. Counters are observability only — no behaviour may branch on them.
- [x] **T002** Unit test `tests/renderer/openPerformance.test.ts`: counter deltas for each record call; `endOpen` without a pending start records nothing; superseded start keeps only the latest duration; `reset` clears everything including durations.

## Phase 2 — Skip the no-op re-parse at editor creation (R1, contract C1) — SC-002

- [x] **T003** In `src/renderer/editor/markdownSyntaxRuntime.ts`: add module-level `WeakMap<Crepe, MarkdownSyntaxOptions>` recording the options whose pipeline was actually applied per editor (absence ⇒ stock defaults); export a field-by-field six-boolean `markdownSyntaxOptionsEqual(a, b)` helper from `markdownSyntaxOptions.ts`; guard `reconfigureEditor` so that after the unconditional `setMarkdownSyntaxGateOptions(options)` it returns before the parser/serializer swap and `replaceAll` when the requested options equal the editor's applied options; set the WeakMap entry whenever the swap runs. The create path (freshly mounted editor, defaults) must now perform no second parse and no mount-time undoable transaction; an off→on toggle round-trip on a live editor must still reapply (per-editor tracking, never a bare default comparison).
- [x] **T004** Unit tests `tests/renderer/markdownSyntaxOptions.test.ts` (extend): `markdownSyntaxOptionsEqual` is true only when all six fields match; defaults vs `{hardBreaks:false}` differ; equal-after-round-trip options compare equal to defaults (the trap case). Round-trip byte-equality test `tests/renderer/markdownSyntaxPipeline.test.ts`: fixtures from `tests/fixtures/roundtrip/` parsed+serialized under the stock pipeline (remark-parse + remark-stringify + remark-gfm/remark-math) and under the swapped-with-defaults composer (`markdownSyntaxRemark(DEFAULTS)`) produce identical strings — the safety precondition for the skip (research R1 residual risk).
- [x] **T005** Instrument parse counting: `recordParse()` in `CrepeHost.tsx` immediately after `new CrepeClass(...)` succeeds (parse #1 of incoming content) and in `reconfigureEditor` immediately before `replaceAll` runs (the swap path's re-parse). With defaults unchanged, one open must count exactly one full parse (SC-002).

## Phase 3 — Doc-identity fast path for outgoing dirty checks (R2, contract C2) — SC-003

- [x] **T006** In `src/renderer/editor/instancePool.ts`: pool entries gain `baselineDoc: unknown | null`; add `setBaselineDoc(documentId, docRef)` (no-op when no entry), `getBaselineDoc(documentId)`, `clearBaselineDoc(documentId)`, and `getLiveDoc(documentId)` returning the registered editor's current ProseMirror `view.state.doc` (or null). `remove()` continues to drop the whole entry (eviction, close, destroy, replacement-commit cleanup all clear the identity implicitly).
- [x] **T007** Record identity at baseline capture: `CrepeHost.tsx` passes the freshly mounted view's `state.doc` reference to `onBaselineCapture(markdown, docRef)`; `EditorPanel.tsx` forwards it to `instancePool.setBaselineDoc(document.id, docRef)` alongside the existing baseline dispatch. Session API shape unchanged.
- [x] **T008** Fast path in `src/renderer/domain/dirty.ts`: `isDirtyLive(doc, getMarkdown, getLiveDoc?, getBaselineDoc?)` gains optional injected identity accessors (purity preserved; existing callers/tests unaffected). After the existing `doc.dirty` / source-view guards, if both accessors return non-null and the live doc is reference-identical to the recorded baseline doc, return clean with zero serialization. Any other case falls back to the exact existing comparison, which increments `recordOutgoingSerialization()` exactly where it serializes. The fast path may only return "clean"; decoration-only transactions (same doc reference) never false-positive; every transaction that changed the document misses the fast path.
- [x] **T009** Wire accessors in `useDocumentSession.ts`: pass `instancePool.getLiveDoc` / `instancePool.getBaselineDoc` into `domainIsDirtyLive`; clear the recorded identity via `clearBaselineDoc` whenever `SAVE_SUCCESS` is dispatched (editorBaseline moves without a remount, so a stale identity could prove the wrong baseline). Gesture-time checks in `useFileOpenGesture.ts`, decision gate `openWithDecision`, and pre-commit gate `handleStagedEditorReady` all inherit the fast path through the shared `isDirtyLive`.
- [x] **T010** Unit tests: extend `tests/renderer/domain/dirty.test.ts` (identical refs ⇒ clean with zero accessor invocations; different refs ⇒ falls back and counts one outgoing serialization; dirty flag still wins at the top; absent accessors preserve old behaviour) and new `tests/renderer/instancePool.test.ts` (set/get/clear/remove semantics; `getLiveDoc` reads through a stub editor action).

## Phase 4 — Defer the initial spellcheck pass (R4, contract C3) — FR-004

- [ ] **T011** In `src/renderer/editor/spellcheckPlugin.ts`: schedule the initial whole-document pass via `requestIdleCallback` with a timeout bound (falling back to `setTimeout` where unavailable), cancelled on plugin destroy together with any pending debounced pass. Incremental re-checks (doc change / runtime change) and the correction menu are unchanged. No spellcheck work may run synchronously inside editor construction or the staging window.

## Phase 5 — Open timing measurement (R6, contract C5) — SC-001/SC-004

- [ ] **T012** Start the clock at open-gesture commit: `useFileOpenGesture.ts` `commitOpen` calls `beginOpen()` immediately before `window.api.readFile`. End at presentation: `CrepeHost.tsx` calls `endOpen()` right after `onReady(crepe)`. Measurement excludes the double-click deferral window by construction.

## Phase 6 — E2E verification (SC-001..SC-005)

- [ ] **T013** New `tests/e2e/open-performance.spec.ts` driving the built app:
  - SC-001: open a generated typical document (~1,000 lines) into a clean active tab repeatedly, read `openDurations` from `window.__mmOpenPerformance`, assert p95 within the 250 ms target multiplied by a documented CI tolerance (×4 when `process.env.CI` is set, ×1 locally). Per the 2026-08-21 clarification (research R7) the fixed budget applies to typical documents; very large documents are governed by SC-004's scaling law.
  - SC-004: repeat against a 10× larger fixture and assert the median ratio stays within twelve times (linear scaling within 20% overhead).
  - SC-002/SC-003: reset counters, open once with settings unchanged, assert exactly one full parse, at most one incoming serialization, zero outgoing serializations for the untouched outgoing tab.
  - SC-005: staged-transition acceptance scenarios re-run unchanged — outgoing editor stays visible until commit, atomic swap, immediate typing lands in the new document with fresh undo, dirty outgoing tab cancels the replacement and opens a new tab instead.
- [ ] **T014** Full verification: `npm run lint`, `npm run typecheck`, `npm run check`, `npm run test`, `npm run test:e2e` all green; existing suites (`open-in-current-tab.spec.ts`, `markdown-syntax-options.spec.ts`, `spellcheck.spec.ts`, dirty/reducer unit tests) pass unchanged, proving FR-005/FR-006 preserved.

## Dependencies

- T001 → T002, T005, T012, T013
- T003 → T004 (tests assert the guard's helper), T005
- T006 → T007, T008, T009, T010
- T008 → T009, T010, T013
- Phases 2–5 are independent of each other except for the shared counters module (T001) and converge in T013/T014.
- Within phases marked [P]-less, run sequentially; files touched by multiple tasks (CrepeHost.tsx, useDocumentSession.ts) sequence those tasks.

## Risk notes (from research.md)

- R1 trap: comparing against bare defaults is wrong — the off→on toggle round-trip must reapply because the live pipeline is non-default. Guard compares per-editor applied options only.
- R2 invariant: reference identity is the *only* skip condition; SAVE_SUCCESS moves `editorBaseline` without a remount, hence T009's explicit clearing.
- R3: the incoming baseline capture stays the single incoming serialization; deriving it from raw disk text is rejected (spec 002 false-dirty regression).
