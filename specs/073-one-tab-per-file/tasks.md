# Tasks: One Tab Per File

**Input**: Design documents from `/specs/073-one-tab-per-file/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/renderer.md`, `quickstart.md`

**Tests**: Required. The plan and research name the unit, main-process, and Playwright coverage, and every user story has an independent test in `spec.md`.

**Organization**: Phases 3 to 5 map to the three user stories. Phase 2 is a blocking prerequisite because every story compares the identity that main starts supplying there.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel with its sibling tasks (different files, no unmet dependency)
- **[Story]**: `[US1]`, `[US2]`, or `[US3]`
- Every task names the exact file or command it touches

## Plan path check

The plan proposes five new test files: `tests/main/identity.test.ts`, `tests/main/read.test.ts`, `tests/renderer/fileIdentity.test.ts`, `tests/renderer/documents.identity.test.ts`, and `tests/e2e/one-tab-per-file.spec.ts`. None exists today and none collides with an existing file. They match `vitest.config.ts` (`tests/main/**/*.test.ts`, `tests/renderer/**/*.test.ts`) and the Playwright `testDir: './tests/e2e'` layout.

One overlap is worth recording: `readFile` already has containment tests in `tests/main/paths.test.ts`, which imports `readFile` from `src/main/fs/read.ts`. The plan's separate `tests/main/read.test.ts` is still valid and does not conflict, so no path correction is needed. The new file is scoped to identity output only, and containment tests stay in `tests/main/paths.test.ts`.

---

## Phase 1: Setup

**Purpose**: Start from a known-clean branch and record the pre-change state.

- [ ] T001 Create the branch `spec-073-one-tab-per-file` from a clean `main` with `git checkout -b spec-073-one-tab-per-file main` before any source edit.
- [ ] T002 Record the clean baseline by running `npm run test` and noting the passing result, so a later regression can be told apart from a pre-existing failure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Produce the file identity in main, guarantee it on `file:read`, and add the one renderer comparison every route will use.

**CRITICAL**: No user story work begins until this phase is complete.

- [ ] T003 Move the existing `canonicalPath` function unchanged from `src/main/ipc/handlers/context.ts` to the new `src/main/fs/identity.ts`, and re-export it from `src/main/ipc/handlers/context.ts` so existing importers such as `tests/main/writeOpened.test.ts` keep working. This is a structural change only, with no behavior change, and must be committed alone with no behavioral edit in the same commit.
- [ ] T004 Change `canonicalPath` in `src/main/fs/identity.ts` to a never-throwing chain: `fs.realpathSync.native(p)`, then `fs.realpathSync(p)`, then `path.resolve(p)`, normalizing each result with `path.normalize`. Do not lowercase, case-fold, or compare basenames. This is a behavioral change and a separate commit from T003.
- [ ] T005 Return `canonicalPath: canonicalPath(resolved)` from `readFile` in `src/main/fs/read.ts`, importing the helper from `./identity`. Keep `resolveFile` and its containment validation unchanged, and add no IPC channel.
- [ ] T006 [P] Extend the comment on `OpenedFile.canonicalPath` in `src/shared/ipc-contract.ts` to state that every successful file-producing main handler supplies it, that the field stays optional, and that the renderer never passes it to `file:read` or `file:write`. Keep the type and shape unchanged.
- [ ] T007 [P] Add `sameFile(a, b)` to `src/renderer/domain/fileIdentity.ts`, taking values shaped like `{ path: string | null; canonicalPath?: string }` and returning a boolean in this order: equal non-empty `canonicalPath` values match, different identities never match, then if either `path` is null return false, otherwise compare the two paths exactly. Treat an empty string as a missing identity and perform no case folding or basename comparison.
- [ ] T008 [P] Add `tests/main/identity.test.ts` with a temp-directory fixture covering the native realpath result, `sub/../a.md` resolution, the `fs.realpathSync` fallback when the native call is mocked to throw, the absolute `path.resolve` fallback for a missing path, and normalization. Assert against `fs.realpathSync.native` output rather than a hardcoded platform path.
- [ ] T009 [P] Add `tests/main/read.test.ts` asserting that `readFile` returns a `canonicalPath` equal to the identity helper for an in-workspace file, and that a path escaping the root still throws `OUTSIDE_WORKSPACE` with no identity in the error. Leave existing containment assertions in `tests/main/paths.test.ts` untouched.
- [ ] T010 [P] Add `tests/renderer/fileIdentity.test.ts` pinning the `contracts/renderer.md` truth table: equal identities, different identities with equal paths, one identity missing with equal paths, one identity missing with one null path, both missing with null paths, both missing with equal paths, and an empty identity treated as missing.

**Checkpoint**: `file:read` carries the identity and the renderer has one comparison to use. No user-visible behavior has changed yet.

---

## Phase 3: User Story 1 - File opened before its folder (Priority: P1)

**Goal**: Opening the containing folder and then the file, by explorer or by Open File, activates the tab that was opened before the folder existed and leaves its unsaved text alone.

**Independent Test**: With no folder open, open `dir/a.md`, type into it, open the folder `dir`, then click `a.md` in the explorer. Repeat the second open with Open File. Each run must show one active tab containing the typed text.

### Implementation for User Story 1

- [ ] T011 [US1] Replace the path-only `find` in `handleOpenExisting` in `src/renderer/state/documents.ts` with `sameFile`. An identity match must activate the existing document, may apply the existing explicit view switch, must not create or stage a document, must adopt a differing incoming `path` and its `title` so the tab saves the file it represents, and must ignore `mode: 'replace'`. Depends on T005 and T007.
- [ ] T012 [US1] Replace the path-only `alreadyOpen` check in `openWithDecision` in `src/renderer/hooks/useDocumentSession.ts` with `current.documents.some((d) => sameFile(d, file))`. Keep the spec 024 replace decision otherwise unchanged. Depends on T011.
- [ ] T013 [P] [US1] Compute `alreadyOpen` in `src/renderer/hooks/useFileOpenGesture.ts` with `sameFile` against a path-only candidate `{ path: node.id, canonicalPath: undefined }`. This only drives the single-click deferral heuristic; the actual open still goes through `file:read` and the reducer. Depends on T007.
- [ ] T014 [US1] Add US1 reducer tests in `tests/renderer/documents.identity.test.ts`: a no-folder open (`path: null` plus identity) followed by an explorer read (relative path plus the same identity) keeps one document, keeps its content and dirty flag, adopts the explorer `path`, and activates it; the reverse order adopts the null path; an incoming `mode: 'replace'` is ignored on an identity match and creates no `pendingReplacement`; a relative path with no identity never matches a document with `path: null`. Depends on T011.

### Tests for User Story 1

- [ ] T015 [US1] Create `tests/e2e/one-tab-per-file.spec.ts` with fixtures `dir/a.md`, `dir/b.md`, `dir2/a.md`, and an empty `dir/sub/`, plus F1: launch with no folder, stub `dialog.showOpenDialog` to `dir/a.md`, choose `Open File…`, type `FIRST `, re-stub the dialog to `dir`, choose `Open Folder…`, click `a.md` in the tree, and assert one tab, `aria-selected="true"`, the typed text unchanged, and `messageBoxCallCount(app)` still 0. Depends on T012 and T013.
- [ ] T016 [US1] Add S3 to `tests/e2e/one-tab-per-file.spec.ts`: open `dir/a.md` with `Open File…` while no folder is open, type `FIRST `, open the folder `dir`, then use `Open File…` again for `dir/a.md` and assert one active tab, the typed text, and no new prompt. Depends on T015.

**Checkpoint**: F1 and S3 pass on the built app, and the reducer test proves the null-path to relative-path identity match.

---

## Phase 4: User Story 2 - Same file, any route (Priority: P1)

**Goal**: Every supported open route agrees on what counts as the same file, and the identity lifecycle follows Save As and in-app rename without changing save, close, or quit behavior.

**Independent Test**: Open a file, type into it, then reopen it by explorer, Open File, recent item, operating-system open, a `..` path, and a repeated operating-system open. After each attempt there is one active tab with the typed text. Separately, `dir/a.md` and `dir2/a.md` stay in two tabs and each save writes only its own file.

### Implementation for User Story 2

- [ ] T017 [US2] Backfill a missing identity in `handleOpenExisting` in `src/renderer/state/documents.ts`: when the matched document has no usable `canonicalPath` and the incoming value has one, store the incoming value on the activated document. When the incoming `path` differs from the stored one, adopt it and the incoming `title`. Do not change `content`, `baseline`, `dirty`, `revision`, cursor, scroll, or view beyond the existing explicit view rule. Depends on T011.
- [ ] T018 [P] [US2] Change `openPathInSource` and `openPathInFormatted` in `src/renderer/hooks/useSourceViewToggle.ts` to read the requested path through `file:read` first and then compare the returned identity with `sameFile`, instead of matching by path before reading. Preserve `flushLiveContent`, `captureContentForSwitch`, `seedSourceContext`, `SET_VIEW`, and `handleReturnToFormatted`, and reactivate an evicted match through the reducer rather than the live-editor path. Depends on T011.
- [ ] T019 [US2] Keep `SAVE_SUCCESS` as the only post-open identity update point in `handleSaveSuccess` in `src/renderer/state/documents.ts`: a Save As payload replaces `path`, `canonicalPath`, and `title` together, and a plain save keeps them. Do not add a Save As merge path. Depends on T017.
- [ ] T020 [US2] Clear `canonicalPath` in `handleUpdatePath` and in every document rewritten by `handleReroutePaths` in `src/renderer/state/documents.ts`, because the old absolute path no longer names the file. Keep `id`, content, dirty flag, revision, and title behavior. Depends on T017.
- [ ] T021 [US2] Add US2 reducer tests in `tests/renderer/documents.identity.test.ts`: an explorer read followed by an operating-system open shape, a `..` resolved identity, two documents with the same relative path and different identities opening two tabs, backfill on activation without a path change, route rebinding when the relative path or root changes, equal paths leaving the title alone, Save As replacing the identity and the old file opening separately, rename clearing the identity, spec 024 replacement when the file is not open, and an identity match taking precedence over `mode: 'replace'`. Depends on T017, T019, and T020.

### Tests for User Story 2

- [ ] T022 [US2] Add H12 and H13 to `tests/e2e/one-tab-per-file.spec.ts`: explorer first then `Open File…`, and `Open File…` first then the explorer, each with typed text retained, one active tab, and no prompt. Depends on T018 and T021.
- [ ] T023 [US2] Add the H8 boundary to `tests/e2e/one-tab-per-file.spec.ts`: open `dir/a.md`, type `DIR1 `, open `dir2/a.md` with `Open File…`, type `DIR2 `, assert two tabs, save both, and assert each file contains only its own marker. The equal-relative-path shape with different identities stays covered by T021. Depends on T022.
- [ ] T024 [US2] Add the Save As lifecycle to `tests/e2e/one-tab-per-file.spec.ts`: stub `dialog.showSaveDialog` locally in the suite (following `tests/e2e/save-opened-file.spec.ts`), save `dir/a.md` as `dir/b.md`, reopen `dir/b.md`, assert the saved tab is activated with its text and no second tab, then make it dirty, open `dir/a.md`, and assert a separate tab whose save writes only `a.md`. Depends on T022.

**Checkpoint**: Explorer, Open File, operating-system open, recent items, context-menu opens, Save As, and rename all agree with the reducer. Spec 024 still decides the case where the file is not already open.

---

## Phase 5: User Story 3 - Case-variant path (Priority: P2)

**Goal**: Letter case is decided by the filesystem through main's native realpath, not by a fixed platform rule in the renderer.

**Independent Test**: On a case-insensitive filesystem, open `dir/a.md`, type into it, then open `dir/A.md` with Open File and confirm one tab with the text intact. On a case-sensitive filesystem, create `a.md` and `A.md` with different content, open both, and confirm two tabs whose saves stay separate.

- [ ] T025 [US3] Verify that `src/main/fs/identity.ts` uses native realpath output with no `toLowerCase`, `localeCompare`, or other case folding, and that `src/renderer/domain/fileIdentity.ts` compares strings exactly. Record the platform and filesystem case sensitivity used for the e2e run in the PR description. Depends on T004 and T007.
- [ ] T026 [P] [US3] Extend `tests/main/identity.test.ts` with a case probe: create `a.md`, compare the helper output for `a.md` and `A.md`, and gate the assertion on the probe result rather than on `process.platform`. When the probe reports one file, assert one identity; when it reports two files, create `A.md` and assert two identities. Depends on T008.
- [ ] T027 [P] [US3] Add F3 to `tests/e2e/one-tab-per-file.spec.ts`. Probe case sensitivity in the suite by writing `dir/a.md` and checking whether a differently cased spelling resolves to it. On a case-insensitive filesystem, open `a.md`, type `LOWER `, then open `A.md` with `Open File…` and assert one active tab with the text and no prompt. On a case-sensitive filesystem, skip that scenario and run the control instead: create `a.md` and `A.md` with different content, open both, type a different marker, save both, and assert two tabs and two intact files. Depends on T015.

**Checkpoint**: The case-insensitive match and the case-sensitive separation control each run on the filesystem that supports them. Linux CI runs the control and skips the match.

---

## Phase 6: Polish and Verification

**Purpose**: Confirm the change is scoped, that the existing invariants still hold, and that every required check is green.

- [ ] T028 Audit the reducer fixtures in `tests/renderer/documents.*.test.ts` and `tests/renderer/helpers.ts`. Add `canonicalPath` to a payload only where a new case needs an identity; leave existing fixtures without one so the path fallback stays covered. Do not remove, relax, skip, or rewrite an existing assertion. Depends on T021.
- [ ] T029 Check that spec 024 replacement and save, close, and quit behavior did not change by running `npm run test -- tests/renderer/documents.open-replace.test.ts tests/renderer/documents.save.test.ts tests/renderer/documents.open-save-close.test.ts tests/renderer/quit.test.tsx` and reading the unchanged expectations in `tests/e2e/open-in-current-tab.spec.ts`. Depends on T021.
- [ ] T030 Review path containment and the preload surface. Confirm `git diff --stat src/preload/index.ts src/main/fs/paths.ts src/main/fs/write.ts` is empty, that no `ipcMain.handle` channel or generic `invoke` was added, and that `readFile` still validates through `resolveFile`. Run `npm run test -- tests/main/paths.test.ts tests/main/writeOpened.test.ts`. Depends on T005.
- [ ] T031 Inspect the full diff with `git diff` and `git diff --stat`. Confirm no change to folder switching, external-change routing, save or quit prompts, tab titles or markers, and no new user-visible message. Any deviation must be recorded in `spec.md` or `plan.md`, not only in code. Depends on T028, T029, and T030.
- [ ] T032 Run the static gates: `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run check`. Depends on T031.
- [ ] T033 Run the focused unit tests: `npm run test -- tests/renderer/fileIdentity.test.ts tests/renderer/documents.identity.test.ts tests/main/identity.test.ts tests/main/read.test.ts`. Depends on T032.
- [ ] T034 Run the full unit suite: `npm run test`. Depends on T033.
- [ ] T035 Run the affected e2e suites: `npm run test:e2e -- tests/e2e/one-tab-per-file.spec.ts tests/e2e/open-in-current-tab.spec.ts tests/e2e/tabs.spec.ts tests/e2e/file-association.spec.ts tests/e2e/save-opened-file.spec.ts`. Depends on T034.
- [ ] T036 Run the full e2e suite: `npm run test:e2e`. Depends on T035.
- [ ] T037 Build the Linux e2e image and run the focused suite when Docker is available: `docker build -f tests/e2e/Dockerfile -t markdownmeister-e2e .` then `docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- tests/e2e/one-tab-per-file.spec.ts'`. If Docker is unavailable, report that verification gap instead of substituting another run. Depends on T036.
- [ ] T038 Run the full Linux e2e suite in the image, one shard at a time: `docker run --rm --shm-size=1g markdownmeister-e2e sh -lc 'xvfb-run -a env MM_E2E_HEADED=1 npm run test:e2e -- --shard=1/2'` then the same command with `--shard=2/2`. Depends on T037.
- [ ] T039 Run the `quickstart.md` manual checks on the current platform: F1, S3, F3, H12, H13, H8, Save As, and the `..` and symlink path variants, asserting no new prompt at every repeated open. Record the platform, filesystem case sensitivity, whether F3 ran or was skipped, and whether the symlink step was skipped. Note that the macOS native realpath behavior still needs confirmation on a macOS host. Depends on T030.
- [ ] T040 When implementation and verification are complete, move the spec with `git mv specs/073-one-tab-per-file specs/archive/073-one-tab-per-file` and set `**Status**: Archived` in the moved `spec.md`, as part of the implementation PR. Depends on T038 and T039.

---

## Out of scope (do not implement)

These are the known limitations in `research.md` R10 and the assumptions in `spec.md`. They are recorded so the implementation does not expand into them.

- Do not merge tabs when Save As targets a file that is already open in another tab. Merging changes dirty-content and undo-history policy and is outside the spec.
- Do not unify hard links. Identity follows the resolved real path, so two hard links remain two documents.
- Do not normalize Unicode (NFC versus NFD) or strip Windows extended-length `\\?\` prefixes.
- Do not add a case-insensitive fallback rule when both realpath calls fail and `path.resolve` is used. That is a degradation path, not a normal route.
- Do not change folder-switch tab lifecycle (report finding F2). Folder switching is out of scope, and tabs are not closed or rebound at switch time. Opening the same file under the new root rebinds that tab's route (FR-009).
- Do not change external rename or delete handling (report finding F4). External-change routing stays by workspace-relative path.
- Do not special-case the interval after an in-app rename, when identity is cleared and the path fallback applies. Reopening the moved file backfills the identity.
- Do not add a prompt when a context-menu open targets a file that no longer exists. It fails quietly, and the deleted-file case is out of scope.
- Do not display the identity or add any new tab title, marker, or warning.
- Do not add an IPC channel, a preload operation, a generic `invoke`, or renderer filesystem access.

---

## Dependencies and execution order

### Phase dependencies

- Phase 1 has no dependency and starts immediately.
- Phase 2 depends on Phase 1 and blocks all user stories.
- Phase 3 depends on Phase 2.
- Phase 4 depends on Phase 2 and on T011, because the identity-first reducer check is shared with US1.
- Phase 5 depends on Phase 2 for T025 and T026, and on T015 for the e2e suite in T027. It does not depend on US2.
- Phase 6 depends on every story task that it verifies.

### User story dependencies

- **US1 (P1)**: T011 to T016. T011 needs T005 and T007; T012 needs T011; T013 needs T007; T014 needs T011; T015 needs T012 and T013; T016 needs T015.
- **US2 (P1)**: T017 to T024. T017 needs T011; T018 needs T011; T019 and T020 need T017; T021 needs T017, T019, and T020; T022 needs T018 and T021; T023 and T024 need T022.
- **US3 (P2)**: T025 to T027. T025 needs T004 and T007; T026 needs T008; T027 needs T015.

### Ordered summary

```text
T001 -> T002 -> T003 (structural commit only)
T003 -> T004 -> T005 -> T009
T004 -> T008 -> T026
T003 -> T006
T003 -> T007 -> T010 -> T011 -> T014
T005 + T007 -> T011 -> T012 -> T015 -> T016
T007 -> T013 -> T015
T011 -> T017 -> T019 -> T021
T011 -> T018 -> T022 -> T023 -> T024
T017 -> T020 -> T021
T011 -> T017 -> T021
T004 + T007 -> T025
T015 -> T027
T021 -> T028, T029
T005 -> T030
T028 + T029 + T030 -> T031 -> T032 -> T033 -> T034 -> T035 -> T036 -> T037 -> T038
T030 -> T039
T038 + T039 -> T040
```

## Notes

- Commit after each task or logical group. T003 is the only structural commit and must stay separate from every behavioral commit.
- Write a story's unit test with its implementation and confirm it fails for the old path-only behavior where practical.
- Do not mix drive-by fixes into this branch. Note unrelated problems instead of fixing them here.
- The branch, push, PR description with `## Summary`, `## Changes`, `## Testing`, the `Generated by <model name>.` line, and the five required reviews are handled after T040. Do not merge the PR from the agent session.
- If a check in T032 to T038 fails, fix the cause and re-run the affected command. Do not skip, weaken, or delete a test to get green.
