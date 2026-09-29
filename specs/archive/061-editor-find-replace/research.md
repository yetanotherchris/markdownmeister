# Research: Find and Replace in the Editor

**Feature**: specs/061-editor-find-replace | **Date**: 2026-09-29

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives.

## R1. Replace extends the existing search state on each surface; the panel stays shared

**Decision**: Add `replaceOpen: boolean` and `replacement: string` to the visual search plugin state and to the source search state field, and expose the three actions (`replaceCurrent`, `replaceAll`) through each surface's existing imperative handle. The shared `SearchPanel` gains the row and calls back into whichever handle owns the active document.

**Evidence**: Specs 055 and 056 already put the query, the match list, the current index, and the highlights in per-surface search state, and already share one panel and one find signal (`src/renderer/search/visualSearch.ts`, `sourceSearch.ts`, `useVisualSearch.ts`, `SearchPanel.tsx`). A replace toggle that lives in a React component would be lost when the panel unmounts on close and could not be revealed by a shortcut while the box is already open; keeping it in the editor state makes `Ctrl+H` idempotent and makes close/tab-switch/view-switch reset it for free (FR-015).

**Alternatives rejected**:

- _Keep the toggle in `SearchPanel` local state_: a second `Ctrl+H` while the box is open could not reveal the row, and the reset rule would have to be re-implemented per surface.
- _A separate replace window or dialog_: the spec explicitly keeps replace in the existing search box without a separate window (FR-014).

## R2. Each replace action is one undo step, isolated from adjacent typing

**Decision**: Visual: build the replacement in a single ProseMirror transaction, call `closeHistory(tr)` on it, dispatch it, then dispatch one meta-only `closeHistory` transaction. Source: dispatch one CodeMirror change set annotated with `isolateHistory.of('full')`.

**Evidence** (read from `prosemirror-history` 6.x and `@codemirror/commands` in `node_modules`):

- One ProseMirror transaction is one history event, so a single transaction can change many occurrences in one undo step. `closeHistory` sets the `closeHistoryKey` meta, which resets the history's previous-time and previous-ranges so the transaction starts a new group (isolating it from typing before it).
- `closeHistory` alone isolates only the previous side: a following typing transaction within `newGroupDelay` that is adjacent to the replace ranges would merge into the replace event (`applyTransaction`, `isAdjacentTo`). A second, meta-only transaction carrying `closeHistory` (zero steps, so it is recorded as no event) resets `prevTime` to 0, so the next typing transaction starts its own group. Together the two dispatches give "the replace is its own step, and typing either side is separate".
- CodeMirror's `isolateHistory` is an annotation taken by the history extension: `"before"` prevents merging with earlier transactions, `"after"` with later ones, `"full"` with both. `"full"` is the exact guarantee FR-006 asks for.

**Alternatives rejected**:

- _Rely on ProseMirror's time-based grouping_: two actions inside 500 ms would merge into one undo step, failing FR-006.
- _CodeMirror `isolateHistory.of('before')` only_: later typing could still be merged in, the same failure on the other side.

## R3. Replace-all resolves overlaps by one pure, unit-tested policy

**Decision**: Add `nonOverlapping(matches)` to `src/renderer/search/findMatches.ts`: walking the ascending matches, keep each match whose `from` is at or after the end of the last kept match. Both surfaces apply replace-all to that subset.

**Evidence**: `findMatches` deliberately reports overlapping candidates (`aa` in `aaa` yields `[0,2]` and `[1,3]`) because find highlights them. Replacement cannot change a character twice in one action, so the spec's edge case pins a single rule: leftmost non-overlapping occurrences, scan resuming after the changed text (spec FR-017). A pure function keeps that rule in one place and independent of either editor.

**Alternatives rejected**:

- _Build the subset inside each editor module_: duplicates the rule and lets the two views drift.
- _Change `findMatches` to report only non-overlapping matches_: find would stop highlighting candidates it currently highlights, changing spec 055/056 behaviour that is out of scope here.

## R4. Inserted text is literal and takes the formatting at the match start

**Decision**: Visual: insert `schema.text(replacement, doc.resolve(from).marks())`, or delete the range when the replacement is empty. Source: insert the replacement string verbatim into the change set.

**Evidence**: `ResolvedPos.marks()` returns the marks active at the node after the position, which is exactly "the formatting in effect at the first character of the match" (FR-019). Passing those marks to `schema.text` inserts plain text that inherits emphasis/strong/link there and changes nothing outside the range. A match spanning differently formatted inline text is still a single text node taking the first character's marks, as the spec states. Source text has no marks, so the replacement is inserted exactly as typed; frontmatter and structural markdown are treated as ordinary text (FR-020, FR-018).

**Alternatives rejected**:

- _Insert unmarked text always_: a replace inside bold or a link would strip formatting from the changed text.
- _Parse the replacement as markdown_: the spec is explicit that replacement is a literal text substitution, never a pattern or a re-parse.

## R5. The source view gains CodeMirror undo history so replace is undoable there

**Decision**: Add the CodeMirror `history()` extension and `historyKeymap` to the source view (`@codemirror/commands`), and exclude the view's external whole-document refresh from history with `Transaction.addToHistory.of(false)`. Promote `@codemirror/commands` to a direct dependency.

**Evidence**: The source view (spec 056) carries no history extension today, so nothing in it is undoable and FR-006/US3-2 cannot be satisfied in source editing. Crepe already bundles `@codemirror/commands` as a transitive dependency (`npm ls` reports 6.10.4 via `@milkdown/crepe`), so promoting it adds no new package. The source view's external refresh effect (its `value` prop changing) is a programmatic whole-document replacement and must not enter the user's undo stack, hence `Transaction.addToHistory.of(false)`; that annotation is read by the history extension.

**Alternatives rejected**:

- _Leave source without undo and satisfy FR-006 only in visual editing_: silently downgrades a requirement in two acceptance scenarios (US3-2, FR-006); AGENTS.md forbids that without recording a deviation, and the honest fix is small.
- _Hand-roll a one-step undo for replace only_: a second, conflicting undo model beside the surface's own; a real history extension is the normal editing model the spec asks replace to use.

## R6. The replace shortcut reuses the find signal with a flag

**Decision**: Add `'replace'` to the `MenuCommand` union, map `Ctrl/Cmd+H` to it in `src/main/shortcuts.ts`, add a hamburger `Replace…` entry, and carry a `replace?: boolean` flag on the existing per-document `FindRequest`. The visual and source surfaces open their search box and set `replaceOpen` when the flag is present.

**Evidence**: Find already routes through the main-process shortcut table and the `menu:command` event to `requestFind(documentId)` (`src/main/shortcuts.ts`, `src/renderer/hooks/useMenuCommands.ts`, `src/renderer/App.tsx`). Replace is the same command with a different presentation, so the smallest change is a flag on the same request rather than a second route. `Ctrl/Cmd+H` is the conventional replace accelerator; the spec records the shortcut in the plan and keeps the feature reachable from the visible toggle regardless.

**Alternatives rejected**:

- _A second `menu:command` listener or a new IPC channel_: needless surface for a presentation flag.
- _No shortcut, toggle only_: the spec's Assumptions expect the shortcut to be recorded in the plan; the accelerator is cheap and discoverable.

## R7. The match count is recomputed from the edited document; replace-current advances past the change

**Decision**: After a replace action the surface recomputes matches from the new document for the unchanged query, and replace-current sets the current match to the first match starting at or after the end of the inserted text, wrapping to the first remaining match. The count shown is that recomputed set.

**Evidence**: Spec FR-004/FR-017 and the clarification "match count is derived, not decremented": a replacement that still contains the query is offered again as a later match and is not treated as already replaced. Both search modules already recompute matches on a document change while the box is open (`stateAfter` in `visualSearch.ts`, the source state field's `update`), so the count follows from re-scanning rather than from arithmetic.

**Alternatives rejected**:

- _Decrement the count by one per replace_: wrong when the replacement text matches the query, and cannot express the overlap policy.

## R8. Scope: one document, view-specific reach

**Decision**: Replace reads and writes only the active document's surface. Visual replace edits the rendered document (so a query matching raw markdown syntax such as `**` matches only in source), and source replace edits the raw markdown including frontmatter. No cross-document or workspace replace.

**Evidence**: The panel and the handle are already per document (`useVisualSearch(documentId, ...)`, and `SourceView` is per `DocumentHost`), and the store's `UPDATE_CONTENT` recomputes dirty for the active document only. The visual editor's search already excludes code-block text from inline matching (node-view highlight, spec 055 R6), so visual reach is the rendered text; the source view joins frontmatter and body into one text (spec 056 R5), so frontmatter is in source scope.

**Alternatives rejected**:

- _Workspace-wide replace_: the spec explicitly scopes replace to the single open document (FR-007, FR-018).

## R9. A replaced editor must not report search state after it is gone

**Decision**: When a visual editor host unmounts, stop routing its search plugin's snapshots to the panel before scheduling its deferred destroy.

**Evidence**: Returning from source editing with an edited body remounts the visual editor (a `REFRESH_FROM_SOURCE` content-version bump). `CrepeHost` destroys the outgoing editor through `requestIdleCallback(..., { timeout: 1000 })`, and the search plugin reports a closed snapshot from its own `destroy()`. That late report arrived after the replacement editor had already reported its state, so reopening find with `Ctrl+F` right after a view switch opened and was then immediately closed again by the stale snapshot, leaving no box. The same remount also replayed the mount-time find request from its `handledFindRef` starting at null, which reopened the replace row from the earlier `Ctrl+H` and kept it after a plain `Ctrl+F`. The failures are pre-existing hazards of the shared per-document search state (they would also bite spec 055 find across any editor remount); spec 061 US3-5 ("switch view ... reopening the box starts empty") requires the box to reopen clean, so both fixes are in scope. Nulling the reporter on unmount is the smallest fix for the stale snapshot (the editor instance is going away, and a replacement reports its own state on creation); seeding `handledFindRef` from the mount-time signal, as `SourceView` already does, limits the create-time replay to a request that genuinely arrived while the replacement editor was still being created.

**Alternatives rejected**:

- _Remove the plugin's `destroy()` notification entirely_: also loses the reset when an editor is replaced without a new one, and changes spec 055 behaviour more broadly.
- _Make `onStateChange` ignore snapshots when `open` is false after a remount_: loses the legitimate close signal when the user dismisses the box while an editor is remounting.
