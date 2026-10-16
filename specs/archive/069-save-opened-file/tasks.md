---
description: "Task list for saving an opened file in place"
---

# Tasks: Save an Opened File in Place

**Input**: Design documents from `/specs/069-save-opened-file/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/save-opened-file.md, quickstart.md

**Tests**: Included. Principle V requires adversarial path tests and atomic-write failure coverage for this change, and AGENTS.md requires a Playwright e2e suite for the user-visible behaviour.

**Organization**: Tasks are grouped by user story after the shared write channel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup (Shared Contract)

**Purpose**: Name the new operation in the types the renderer and main already share.

- [x] T001 Add `writeOpenedFile(canonicalPath: string, content: string)` to `DesktopApi` and the `file:writeOpened` request type in `src/shared/ipc-contract.ts`
- [x] T002 [P] Expose `writeOpenedFile` as a named preload method on `file:writeOpened` in `src/preload/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Main can write only an allowlisted real path, and a save success can record a null relative path.

**Critical**: No user-story work begins until this phase is complete.

- [x] T003 Add the process-lifetime opened-path allowlist to `ctx` in `src/main/ipc/handlers/context.ts`, and add the real path from `openFileFromPath` when an open succeeds
- [x] T004 Implement `file:writeOpened` in `src/main/ipc/handlers/files.ts` and the absolute-path atomic write next to `writeFile` in `src/main/fs/write.ts`: allowlist check, existing-file check, `atomicWrite`, and the same errno mapping as `writeFile`. Cover it in `tests/main/writeOpened.test.ts` with an authorized write, a missing file that is not created, a directory, a path that was never opened, a `..` path, a symlink whose real path is not allowlisted, and scrubbed error text
- [x] T005 Return `canonicalPath` from `file:saveDialog` in `src/main/ipc/handlers/files.ts` and allowlist the chosen real path only after the write succeeds. Extend `tests/main/writeOpened.test.ts` with cancel (no allowlist entry) and a successful outside-folder choice
- [x] T006 [P] Teach `SAVE_SUCCESS` in `src/renderer/state/documents.ts` to store a null `path` (clearing a previous relative path), replace `canonicalPath`, and update the title from `name`. Cover the transitions from `data-model.md` in `tests/renderer/documents.save.test.ts`

**Checkpoint**: The channel rejects unopened paths and does not create a missing file. The reducer can retarget a document onto a file outside the folder.

---

## Phase 3: User Story 1 - Save writes the opened file (Priority: P1)

**Goal**: Save and the save shortcut write an opened file that has no workspace-relative path, and files inside the folder keep saving as they do now.

**Independent Test**: With no folder open, open a file, edit, and save. The original file changes and no location dialog appears. The same holds for a file outside an open folder. A file inside the folder still saves in place.

- [x] T007 [US1] In `src/renderer/hooks/useDocumentSession.ts`, call `writeOpenedFile` when `path` is null and `canonicalPath` is set, unless the caller forced the dialog. On failure dispatch `SAVE_FAILED` and do not call `saveFileDialog`
- [x] T008 [P] [US1] Extend `tests/renderer/useDocumentSession.save.test.tsx` so a document with only `canonicalPath` saves through `writeOpenedFile`, a document with `path` still uses `writeFile`, and a failed opened-file write does not call `saveFileDialog`
- [x] T009 [US1] Add `tests/e2e/save-opened-file.spec.ts` for the reproduced cases: Open File with no folder (Save before an edit, and Save plus the save shortcut after an edit), Open File outside an open folder, Open File inside an open folder, and a file opened from the explorer

---

## Phase 4: User Story 2 - The file stays the save target (Priority: P1)

**Goal**: A later Save uses the same file. Save As retargets, including to a file outside the folder. A never-saved document and a cancelled Save As stay as they are. Close and quit Save write an opened file in place.

**Independent Test**: Save an opened file twice with no location dialog. Save As to a file outside the folder, then Save. Only the chosen file changes. Cancel Save As and the previous file remains the target. A new document still asks for a location.

- [x] T010 [US2] Pass `path: null` and the written `canonicalPath` from both success sites in `src/renderer/hooks/useDocumentSession.ts` when the target is outside the folder, and pass the new relative path when Save As stays inside the folder
- [x] T011 [US2] Extend `tests/renderer/useDocumentSession.save.test.tsx` to assert Save As success replaces `canonicalPath`, clears a previous relative path when the chosen file is outside the folder, and a cancelled dialog leaves the association unchanged. Assert close and quit Save of an opened file call `writeOpenedFile` rather than `saveFileDialog`
- [x] T012 [US2] Extend `tests/e2e/save-opened-file.spec.ts` with a second Save of the same file, Save As to a file outside the folder followed by Save, a cancelled Save As, and Save of a never-saved document

---

## Phase 5: User Story 3 - A failed save does not ask for a new location (Priority: P2)

**Goal**: An unwritable or missing opened file stays unsaved, the target is not truncated or recreated, and direct Save shows no location dialog.

**Independent Test**: The main-process tests reject a missing allowlisted path without creating a file and map a locked file to `LOCKED`. The renderer test shows that failure does not open the dialog.

- [x] T013 [US3] Add the locked-file and unsaved-document assertions that are not already in T004 and T008: `tests/main/writeOpened.test.ts` maps `EACCES` / `EBUSY` / `EPERM` to `LOCKED` and leaves the original bytes intact, and `tests/renderer/useDocumentSession.save.test.tsx` keeps the failed document unsaved with no `saveFileDialog` call. The removed-file confirmation in `src/renderer/hooks/useExternalFileEvents.ts` must still force the dialog

---

## Phase 6: Polish

- [x] T014 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` and fix failures from this feature
- [x] T015 Move `specs/069-save-opened-file/` to `specs/archive/069-save-opened-file/` with `git mv` and set `**Status**: Archived` in `spec.md` once the feature is implemented and its pull request is opened

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001 and T002 touch different files and can run together.
- **Foundational (Phase 2)**: T004 and T005 depend on T003. T006 can run beside T003. T004 depends on the contract types from T001.
- **US1 (Phase 3)**: T007 depends on T002, T004, and T006. T008 depends on T007. T009 depends on T007.
- **US2 (Phase 4)**: T010 depends on T005, T006, and T007. T011 depends on T010. T012 depends on T010.
- **US3 (Phase 5)**: T013 depends on T004 and T007. It must not remove the forced dialog in `useExternalFileEvents.ts`.
- **Polish (Phase 6)**: T014 depends on every story. T015 happens in the implementation pull request, after the behaviour is in.

## Parallel Opportunities

- T001 and T002 can run together.
- T006 can run while T003, T004, and T005 are in progress.
- T008 and T009 can run together after T007.
- T011 and T012 can run together after T010.

## Implementation Strategy

### MVP First (User Story 1)

T001 through T009 are enough to fix the reported case: open a file that is not inside a folder, choose Save, and write that file. US2 makes the next Save and Save As follow the same association. US3 locks the failure behaviour that must not fall through to the dialog.

### Parallel Team Strategy

One person can take the main-process channel (T003 to T005) while another takes the reducer (T006) after T001 lands. The renderer hook (T007, T010) starts when the channel and the reducer payload exist.

## Notes

- Do not widen `file:write` or `resolveWithinRoot` to accept an arbitrary absolute path.
- Do not clear the allowlist when the open folder changes.
- Archive the spec only in the implementation pull request. This task list ships with the spec before that implementation.
