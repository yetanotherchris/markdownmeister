# Data Model: Fast Same-Tab Document Open

Feature: [spec.md](./spec.md) | Plan: [plan.md](./plan.md) | Date: 2026-08-20

No new persisted entities and no IPC schema changes. This feature adds renderer-memory state to existing structures and one new renderer-only module.

## Existing entities touched

### DocumentState (`src/renderer/state/documents.ts`)

Unchanged shape. Relevant existing fields:

- `editorBaseline: string` — serialized text the live editor is considered at; dirty = live content differs from this. Captured via `CAPTURE_BASELINE`, refreshed on save/reload/refresh-from-source.
- `dirty: boolean` — debounced flag derived in `handleUpdateContent`; never trusted for open/commit decisions.
- `pendingReplacement` / `panelId` / `contentVersion` — staged-replacement machinery from spec 032; untouched.

**Addition**: the pool entry (not DocumentState) gains the recorded document identity described below; the reducer's `CAPTURE_BASELINE` handler passes it through to the pool. No reducer logic changes beyond that wiring.

### Instance pool entry (`src/renderer/editor/instancePool.ts`)

**New field**: `baselineDoc: unknown | null` — reference identity of the ProseMirror document object at the moment `editorBaseline` was captured. Set by the baseline-capture path; cleared when the entry is evicted or destroyed. Used exclusively by the dirty fast path (contract in [contracts/open-performance.md](./contracts/open-performance.md)).

### Applied syntax options (`src/renderer/editor/markdownSyntaxRuntime.ts`)

**New module-level state**: `WeakMap<Crepe, MarkdownSyntaxOptions>` recording the options whose parser/serializer pipeline was actually applied to each editor. Absence means the editor was freshly constructed against Crepe's stock pipeline, i.e. effectively the defaults. Populated by `reconfigureEditor` whenever the swap runs; consulted by the skip guard. Lives and dies with each editor instance (WeakMap semantics), so no explicit cleanup.

## New module

### Open-performance counters (`src/renderer/editor/openPerformance.ts`)

Renderer-memory only counters, resettable, read from e2e via page context:

| Counter | Meaning | Spec criterion |
|---|---|---|
| `fullParses` | whole-document parse passes over incoming content per open | SC-002 (exactly 1) |
| `fullSerializations` | whole-document serializations of incoming content for baseline/bookkeeping | SC-003 (≤ 1) |
| `outgoingSerializations` | whole-document serializations triggered by outgoing dirty checks | diagnostic (fast-path effectiveness) |
| `openDurations[]` | ms from open-gesture commit to editor-ready | SC-001/SC-004 aggregation |

## State transitions

Unchanged from spec 032: `OPEN_EXISTING` → staged `pendingReplacement` → `COMMIT_STAGED_REPLACEMENT` (or `CANCEL_STAGED_REPLACEMENT`). The fast path only changes *how cleanliness is proven* inside the existing gates, not which transitions occur.

## Validation rules

- Fast path may return "clean" **only** under reference identity of the recorded doc; every other case must run the exact existing comparison.
- Options guard must compare against applied options (per-editor), never raw defaults alone.
- Counters must never gate user-facing behaviour; they are observability only.
