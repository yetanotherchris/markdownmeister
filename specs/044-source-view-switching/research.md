# Research: Reliable Source View Switching

Date: 2026-08-24. Every claim was verified against this worktree during planning (paths and line numbers). The freeze mechanism is established by code analysis, not yet by a reproduced failure; the implementation phase must include a reproduction script.

## R1 - Mode-switch topology: both surfaces exist; only SourceView mounts and unmounts

**Decision**: Treat the switch as a store transition plus an overlay swap around a permanently mounted visual editor.

**Evidence**: `EditorPanel.tsx:49` computes `inSource`; lines 81-100 render one host div whose visibility depends on activation, with the visual editor keyed by `` `${document.id}-v${document.contentVersion}` `` (:88) so it is destroyed and recreated only when `contentVersion` changes. SourceView conditionally mounts at :101-113 as an absolutely positioned overlay (`editor.css:147-159`, z-index 20). While source view is open, the Milkdown instance stays fully mounted but locked and inert (`CrepeHost.tsx:85-92`, lock flag at :80-81).

## R2 - Root freeze mechanism (H1): debounced emission dropped at the lock, then forced remount churn

**Decision**: Fix the divergence at its source by capturing live editor content synchronously when entering the source view, instead of relying on a dirty-flag precondition that misses fresh edits.

**Evidence chain**: The trailing-node plugin inserts an empty paragraph whenever the document's last block is not a paragraph or heading (`node_modules/@milkdown/crepe/lib/esm/builder.js:136` uses it; this is the concrete "click at the bottom creates a new section" path). That transaction reaches the app's listener only after a 200 ms debounce (`node_modules/@milkdown/plugin-listener/lib/index.js:76-91`). Entering source view calls `flushLiveContent()` (`useSourceViewToggle.ts:29`), but its precondition `shouldFlushLive` requires the document's `dirty` flag to already be true (`src/renderer/domain/dirty.ts:53-59`), which cannot be the case inside the debounce window. Once the view flips, `lockedRef.current` is true and the late emission is dropped, not deferred (`CrepeHost.tsx:148-154`). Store and hidden editor now disagree. On return, `editorMatchesContent(live, doc.content)` fails (`useSourceViewToggle.ts:46`, definition `documents.ts:12-16`), forcing `REFRESH_FROM_SOURCE` with `contentVersion++` (`documents.ts:504-526`) and therefore a full unmount/re-parse of the editor (`EditorPanel.tsx:88`) while the old instance lingers up to 1 s on a `requestIdleCallback` destroy (`CrepeHost.tsx:214-223`). Each toggle repeats a full serialisation plus parse plus deferred destroy plus a spellcheck initial pass (`spellcheckPlugin.ts:129-136`); the cost stacks across toggles, matching the reported progressive freeze. Ctrl+S survives a wedged renderer because shortcuts are intercepted in the main process (`src/main/shortcuts.ts:47-58`), which explains the reported workaround. The renderer has no error boundary anywhere, so any exception during this churn takes down or locks the surface entirely.

**Consequences beyond the freeze**: the dropped emission means the just-inserted section never reaches the store until some other edit flushes it; the user's visible text can vanish. FR-003 exists because of this.

**Alternatives considered**:

- *Replay queued emissions after unlock* - keeps two sources of truth racing and needs ordering machinery for a problem solved by reading current bytes once at switch time. Rejected.
- *Remove the emission lock* - would let late emissions overwrite source-view edits arriving through the store; the lock is correct once the pre-switch capture makes drops harmless. Rejected.
- *Force a flush from a listener-side timer* - still timing-based and racy against click latency. Rejected.

## R3 - Position restore today: captured on deactivation, zeroed by the refresh path

**Decision**: Keep offsets across the refresh path instead of zeroing them, and make selection restoration throw-safe.

**Evidence**: Deactivating the visual editor captures `{ cursorOffset, scrollTop }` into the store (`CrepeHost.tsx:106-113`, dispatch via `useDocumentSession.ts:354-359`, reducer `documents.ts:379-390`). Restoration exists in `applyCursorState` (`CrepeHost.tsx:94-104`): clamps the offset with `Math.min`, sets a TextSelection, reapplies scrollTop, but skips everything when values are 0 and performs no scroll-into-view. `REFRESH_FROM_SOURCE` deliberately zeroes both fields (`documents.ts:519-520`, asserted at `tests/renderer/documents.view.test.ts:125-166`), which is why every source-edit round trip lands at the top today. Two hazards need handling: `TextSelection.create` throws RangeError when the stored offset resolves inside a non-text location of the freshly parsed document (`CrepeHost.tsx:99`), and the init effect only guards `crepe.create()` with try/catch (`CrepeHost.tsx:169-175`), leaving later steps as unhandled rejections.

## R4 - Secondary jank amplifier: per-frame store dispatches while scrolling the source view

**Decision**: Coalesce scroll capture to animation frames. Not the root cause; include as cheap hygiene under FR-001's responsiveness requirement.

**Evidence**: `SourceView.tsx:87` attaches a passive scroll listener calling `captureContext` per event; each call dispatches `CAPTURE_SOURCE_CONTEXT` (`useDocumentSession.ts:361-369`), re-rendering the whole app including every hidden editor panel (`App.tsx:370-386` maps all documents).

## R5 - Hard-failure variant (H3): unguarded serializer and selection exceptions

**Decision**: Guard the specific exception sites on the switch path and add one error boundary around the editor host subtree; do not attempt broader catch-all wrapping.

**Evidence**: The serializer throws when a node lacks a `toMarkdown` handler for the active syntax configuration (`node_modules/@milkdown/transformer/lib/index.js:213-216`; handlers rebuilt from options in `markdownSyntaxRuntime.ts:73-80`), so `getMarkdown()` on the toggle path (`instancePool.ts:63-69`, called from `dirty.ts` helpers) can throw for documents containing constructs disabled by settings. Selection creation can throw as described in R3. With no error boundary in the renderer, such an exception kills the interaction or the tree, presenting as "frozen". A boundary keeps the previous usable surface and satisfies FR-006 and Principle IV's quiet-error rule.

**Alternatives considered**: global window error handlers that swallow errors - hides defects and violates honest failure reporting. Rejected. Try/catch around every store action - broad, imprecise, discourages correctness at the source. Rejected.

## R6 - Remount-on-divergence stays; no setMarkdown into surviving instances

**Decision**: After R1-R3 remove the divergence, keep the existing architecture where content replacement always goes through a keyed remount fed from the store.

**Evidence**: The Crepe/Milkdown API offers no supported way to swap document content into a constructed instance while preserving undo history; the project already re-decided this with evidence during spec 001 (AGENTS.md worked example: one instance per tab, content set at construction). The remount path is also directly tested (`tests/renderer/documents.view.test.ts:125-166`).

## Testing strategy

- Unit: new policy function for switch-time capture (clean doc skips serialisation via the baseline-doc identity fast path, `dirty.ts:29-32` and `instancePool.ts:34-61`; changed doc dispatches UPDATE_CONTENT); reducer tests updating the REFRESH_FROM_SOURCE expectations from "zeroes offsets" to "retains offsets" (deliberate behavioural change recorded in plan.md); pure clamp/near-position helper tests.
- E2E (extends `tests/e2e/source.spec.ts` patterns): type-at-end then immediate View source asserts typed text present in the source textarea; 20-toggle loop asserts final toggle responsiveness; position restore assertions read caret offset and scrollTop via page evaluation before and after an unedited round trip; edited round trip asserts caret not reset to start.
- Reproduction first: the failing sequence (click bottom, immediate View source, return) must be demonstrated broken before the fix commit and green after it.

## References

- Trailing node insertion: `node_modules/@milkdown/plugin-trailing/lib/index.js` (appendTransaction)
- Listener debounce: `node_modules/@milkdown/plugin-listener/lib/index.js:76-91`
- Serializer throw site: `node_modules/@milkdown/transformer/lib/index.js:213-216`
- Switch flow: `src/renderer/hooks/useSourceViewToggle.ts`, `src/renderer/hooks/useDocumentSession.ts:82-93`
- Position capture/restore: `src/renderer/editor/CrepeHost.tsx:94-113,230-240`
- Refresh/remount: `src/renderer/state/documents.ts:504-526`
