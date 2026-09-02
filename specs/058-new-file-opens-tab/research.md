# Research: New Explorer File Opens in a Tab

**Feature**: specs/058-new-file-opens-tab | **Date**: 2026-09-02

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives. Line references are against the tree at the time of writing.

## R1. A creation commit is distinguishable from an ordinary rename

**Decision**: Track the placeholder entry created by the New File flow between creation and commit/cancel; trigger the open only when that specific entry's naming input is confirmed.

**Evidence**: The creation flow is already a three-step sequence in `useWorkspaceTree`: `handleCreate` creates the file on disk under a placeholder name, inserts it, and opens the inline naming input (src/renderer/hooks/useWorkspaceTree.ts:134-174, `setPendingEditId` at :173); confirmation goes through `handleRename` (:103-115), cancellation through `handleEditingCancelled` (:117-131), which trashes the placeholder. Remembering the placeholder id in a ref gives the hook an exact, cheap way to know that a rename is a creation commit.

**Alternatives rejected**:

- _Opening inside `handleCreate`_: opens the placeholder-named file before it is named, then again after rename; two opens, the first showing the wrong document.
- _Opening on every successful rename_: ordinary renames of existing files would spuriously open them.

## R2. The open rides the existing open path, with new-tab mode forced

**Decision**: On a confirmed creation commit, call the same open function the tree's Open action uses, in new-tab mode.

**Evidence**: Tree activation opens files through the session hook's open functions (src/renderer/hooks/useDocumentSession.ts:435-472), which dispatch `OPEN_EXISTING` (src/renderer/state/documents.ts:189-248). That path already implements duplicate prevention: an existing tab for the same path is re-activated instead of duplicated (documents.ts:191-229, covered by tests/e2e/tabs.spec.ts:82-90). It also carries an open-mode parameter used by the open-behaviour setting; for creation, new-tab mode is forced because a just-created empty file must never displace an active document, dirty or not (FR-003 and FR-007).

**Verification obligation**: The exact open-function signatures and mode parameter shapes must be read from `useDocumentSession.ts` during implementation before wiring; this plan records the flow, not a memorised signature.

**Consequence**: FR-001, FR-003, and FR-007 come from reusing tested machinery; the new code is the placeholder tracking and one call.

## R3. The opened document is empty and clean by construction

**Decision**: No special handling for the new tab's content or dirty state.

**Evidence**: The creation handler on the main process writes an empty file (`src/main/fs/mutate.ts` createFile writes an empty file with an exclusive-create flag), and the open path loads from disk and starts clean for a file with no unsaved history. FR-002 therefore holds without new state.

## R4. An existing e2e expectation changes with this spec, deliberately

**Decision**: Update, do not weaken, the creation e2e.

**Evidence**: tests/e2e/organize.spec.ts:237-250 creates a file and asserts tree visibility and on-disk existence; asserting the absence of a tab was implicit in the old behaviour, and this spec changes that behaviour. The scenario gains the assertion that the created file is open in an active tab (the new specified behaviour), and a separate new suite covers the dirty-tab, cancellation, folder, and duplicate cases so the guard rails are pinned.

## R5. Failure and cancellation need no new code paths

**Decision**: Do nothing on failure or cancellation; the existing flows already end correctly.

**Evidence**: A failed rename leaves the naming input open with its validation message (existing behaviour; FR-004 and FR-005 preserved), and cancellation trashes the placeholder and leaves no tab; in both cases the hook simply never reaches the open call, because the open is triggered only by a confirmed commit (R1).
