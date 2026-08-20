# Contract: Open Performance

Feature: [spec.md](./spec.md) | Plan: [plan.md](./plan.md) | Date: 2026-08-20

Internal renderer contracts for the fast same-tab open. There are **no** IPC, preload, or filesystem contract changes; this document fixes the behaviour of the renderer-internal seams this feature touches so tasks and tests can rely on them.

## C1 — Reconfigure skip guard (`reconfigureEditor`)

```
reconfigureEditor(editor, options, params)
  1. ALWAYS setMarkdownSyntaxGateOptions(options)   // input-rule gate tracks options
  2. applied := appliedOptions.get(editor) ?? DEFAULT_MARKDOWN_SYNTAX_OPTIONS
  3. IF applied equals options field-by-field (six flat booleans):
       RETURN without swapping parser/serializer and without replaceAll
  4. ELSE run existing swap + replaceAll path
  5. appliedOptions.set(editor, options)
```

Invariants:

- A freshly constructed editor is always considered "at defaults" (its content was parsed by Crepe's stock pipeline).
- An off→on toggle round-trip must reapply the swap even though requested options equal defaults, because the live pipeline is non-default — hence per-editor tracking, never a bare default comparison.
- The gate-options update in step 1 is unconditional: input-rule gating must reflect requested options even when the pipeline skip fires.
- Callers' observable behaviour (emissions, cursor restore) is unchanged on the non-skip path.

## C2 — Dirty fast path (`isDirtyLive` via pool)

```
isDirtyLive(doc, getMarkdown):
  as today, EXCEPT before serializing:
    entry := pool.get(doc.id)
    IF entry exists AND entry.baselineDoc is set AND view.state.doc === entry.baselineDoc:
       RETURN not doc.dirty            // zero serialization; provably at baseline
    ELSE:
       RETURN existing getMarkdown()-based comparison
```

Invariants:

- Reference identity of the ProseMirror document object is the *only* condition that skips serialization. Any transaction that changed the document changes the reference.
- Decoration-only transactions (spellcheck marks, selections) do not change the reference and therefore do not false-positive.
- The fast path may only return "clean"; it never returns "dirty" without the exact comparison having run or `doc.dirty` already being set.
- `baselineDoc` is recorded at baseline capture and cleared on eviction/destroy/replacement commit.
- Pre-commit staged-replacement dirty re-check keeps using this function, preserving Principle III semantics exactly.

## C3 — Deferred initial spellcheck pass

```
on view creation: requestIdleCallback(() => schedule(), { timeout: BOUND })
on destroy: cancel both the idle callback and any scheduled pass
incremental re-checks: unchanged (debounced on doc change / runtime change)
correction menu: unchanged (reads DOM marks at right-click time)
```

Invariants:

- Marks may appear after presentation but must appear within the idle timeout under normal conditions.
- No spellcheck work may run synchronously inside editor construction or the staging window.

## C4 — Instrumentation counters (`openPerformance.ts`)

```
counters: { fullParses, fullSerializations, outgoingSerializations, openDurations[] }
reset(): clears all counters
exposure: page-context global for e2e reads; no preload/IPC involvement
```

Invariants:

- Counters are observability only; no user-facing behaviour may depend on them.
- Parse counting wraps whole-document parse passes over incoming content; serialization counting distinguishes incoming-baseline from outgoing-dirty-check serializations.
- The SC-002 single-parse assertion applies when display settings are unchanged (matching FR-002); a settings-changed open legitimately re-parses.

## C5 — Open timing measurement

```
start := open-gesture commit (after double-click deferral window, at readFile initiation)
end   := editor-ready signal for the incoming document (onReady)
duration appended to openDurations[]
```

Invariants:

- Measurement excludes the intentional gesture-deferral window by definition of the start point.
- p95 aggregation over repeated runs is the reported figure for SC-001/SC-004.
