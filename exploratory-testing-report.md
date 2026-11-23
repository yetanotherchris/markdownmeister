# Exploratory Testing Report: Opening, Saving and Duplicate Files

Date: 2026-11-20. Revised: 2026-11-22 after independent verification (section 12). Platform: macOS (Darwin 25.6.0, case-insensitive APFS). Build: `npm run build` on branch `docs/release-artifact-findings`. At the original build, `git diff main -- src tests` was empty, so the tested source matches `main`. The original run did not test Windows, Linux, real Finder or Explorer; independent Windows verification is recorded in section 12.

## TL;DR

Four bugs were found. F1, F2 and F3 let the app silently overwrite a file with the wrong content. F4 recreates a file opened from the folder explorer after it was renamed or deleted outside the app. F1 to F3 share a cause: the app compares path strings instead of the file's real identity, so the same file can look different across routes, folders, or letter case. Section 8 records the reporter's decisions Q1 to Q4 and Q5's resolution. No open questions remain. The report also includes a catalogue of happy and sad path test cases (section 6) and spec seeds (section 7), followed by decisions, gaps and plan notes. An independent verification on Windows reproduced all four findings and corrected a small number of citations, scope statements and one result (section 12).

Terms: "open folder" is the folder shown in the explorer (the codebase calls it the workspace). "Dirty" means the tab has unsaved edits. "Clean" means no unsaved edits.

## 1. Scope and method

The original report was informal and had no ticket: problems saving files, opening files, and "duplicating files in the explorer". The exploration combined these entry points:

- Menu: File→Open File and File→Open Folder.
- Explorer: clicking a file in the tree.
- OS open: Finder or Explorer handing a path to the app, as a launch argument or to a running instance.
- External changes: files copied, renamed, deleted or overwritten outside the app while open.

The app has no explorer "Duplicate" command (the tree context menu offers Open, View source, Reveal, Rename, Delete). The reporter confirmed they duplicated files with the operating system's Finder or Explorer, not in the app. Copying a file that way while it is open worked correctly (case H11), so the duplicate-related symptoms are more likely F1 (a second tab for the same file) or F4 (a recreated file).

Method: throwaway Playwright scripts launched the built Electron app. Native open dialogs were stubbed to return chosen paths. OS open was emulated by launching a second Electron process with the same user-data directory (as `tests/e2e/file-association.spec.ts` does) and by launch arguments. Every case checked tab count, active tab content, dirty markers, tree rows and the bytes on disk.

Harness caveats that affect results:

- Native message boxes are stubbed and return the dialog's `cancelId` by default. For the unsaved-changes and folder-switch dialogs that is Cancel, so those confirmations do not proceed unless a case chooses a button explicitly (for example cases S5, S7 and H15). For the removed-file dialog the `cancelId` is OK, which is why the default answers OK there (F4).
- Tab titles update shortly after a click, so reads must wait for the state to settle.
- Spec 024 makes opening a file from the explorer replace a clean active tab. A "one tab" check with a clean first tab proves nothing about deduplication, so dedup cases keep the first tab dirty.

## 2. Severity rubric and naming

- High: silent loss or overwrite of user content.
- Medium: unwanted side effect, or the same loss but only on a narrower path.
- Findings are F1 to F4. Proposed specs are A (F1 and F3), B (F2) and C (F4). Real numbers are assigned by `/speckit.specify`.

## 3. Summary

| ID | Severity | Finding | Silent content loss | Proposed spec | Blocked by |
|----|----------|---------|---------------------|---------------|------------|
| F1 | High | File opened with no folder open, then its folder opened, then clicked in the explorer: second tab for the same file | Yes: one tab's edits overwritten by the other's save | A | none |
| F2 | High | After switching folders, clicking a file whose relative path matches an old tab activates the old tab, showing the previous folder's file; saving writes that content into the new folder's file | Yes: the new folder's file is overwritten | B | none (Q1 decided) |
| F3 | Medium | Case-variant path of an open file opens a second tab (case-insensitive filesystem) | Yes: same overwrite as F1 | A | none (Q4 decided) |
| F4 | Medium | Save of a file opened from the explorer after it was renamed or deleted outside the app recreates it at the old path and the explorer does not show it | No (creates an unwanted file) | C | none (Q2, Q3 decided) |

Independent Windows verification reproduced all four findings (section 12).

F3 is Medium because it needs a differently cased path to the same file, which is less common than F1.

## 4. Fixtures

Contents are exact, with a trailing newline.

| File | Content |
|------|---------|
| `dir/a.md` | `# A`, blank line, `alpha` |
| `dir/b.md` | `# B`, blank line, `beta` |
| `dir2/a.md` | `# A2`, blank line, `alpha two` |
| `other/x.md` | `# X`, blank line, `outer` |

Typing in the editor with the caret placed on the heading inserts the typed text into the heading line (for example `# AFIRST `). The cases below check for the typed marker, not exact bytes.

## 5. Findings

### F1: duplicate tab after file-then-folder

Steps:
1. Launch with no folder open.
2. File→Open File: `dir/a.md`. Click in the editor and type `FIRST ` (the tab becomes dirty).
3. File→Open Folder: `dir`.
4. Click `a.md` in the explorer.

Observed: two tabs, `a.md •` (dirty) and `a.md` (clean).

Silent overwrite (continuing): in the second tab type `SECOND ` and Save. The file contains `SECOND`. Switch to the first tab and Save. The file now contains `FIRST` only, both tabs show clean, and the `SECOND` edit is gone.

Expected: the explorer click activates the existing tab. One tab per file.

Variants:
- Outside file, then its parent folder, then a click in the explorer: same duplicate (`x.md •` and `x.md`).
- Same duplicate when the second open is File→Open File on the same path after a folder is open. This was found in the accuracy review's re-run, not in the original scripts.
- Folder first, then the same file via Open File, in either order: no duplicate (see H12 and H13). These pass only because both routes yield the same relative path string.

### F2: wrong file after switching folders

Steps (clean tab):
1. File→Open Folder: `dir`. Click `a.md` (clean).
2. File→Open Folder: `dir2` (also has `a.md`).
3. Click `a.md` in the explorer.
4. Type `EDIT ` and Save.

Observed: the old tab is activated and shows `dir/a.md`'s content (`A / alpha`). After Save, `dir/a.md` is unchanged and `dir2/a.md` contains `dir`'s content plus the edit (`# AEDIT `, `alpha`). The original `dir2/a.md` content (`alpha two`) is gone. This reproduced three times (two macOS runs and one independent Windows run; section 12).

Dirty tab (S5 and S7): with a dirty tab, switching folders shows a confirmation ("Open folder with unsaved changes?", buttons Save All, Cancel, Discard). The harness first answered Cancel, so the folder never changed, and an earlier version of this report wrongly treated that as the folder switching with no prompt. Choosing Save All: the saved tab stays open and clean, clicking `dir2/a.md` shows `dir`'s content, and saving overwrites `dir2/a.md` with it. So the bug applies after Save All as well. The Discard path was not run.

Expected: the tab for the old folder's file never shows or saves into the new folder's file, and clicking `dir2/a.md` opens `dir2/a.md`.

### F3: duplicate tab for a case-variant path

Steps (case-insensitive filesystem):
1. File→Open File: `dir/a.md`. Type `LOWER `.
2. File→Open File: `dir/A.md` (same file). Type `UPPER `. Save.
3. Switch to the first tab and Save.

Observed: two tabs (`a.md`, `A.md`); the file ends up holding only the first tab's text. Not applicable on case-sensitive filesystems. Reproduced on the case-insensitive Windows 11 NTFS volume used for verification: `fs.realpathSync` preserved the caller's letter case while `fs.realpathSync.native` returned the on-disk case for the same file (section 12).

### F4: Save after external rename or delete

Steps:
1. File→Open Folder: `dir`. Click `a.md`. Type `REN ` (dirty).
2. Outside the app, rename `dir/a.md` to `dir/moved.md`.
3. The app shows "a.md was deleted or renamed on disk. Its content is still open here; you can save it to a new location." with buttons `Save As...` and `OK` (`src/shared/nativeDialog.ts`). The tab gets a `!` marker. Choose OK (the stub's default returns the dialog's `cancelId`, which is OK here; `Save As...` is the default button).
4. Press Save.

Observed: no further dialog. `dir/a.md` is created again with the edited content, so the folder holds `a.md`, `b.md` and `moved.md`. The `!` and dirty markers clear. At 1 second and still at 3 seconds after the Save the explorer lists only `b.md` and `moved.md`.

Expected per spec 069: FR-009 says "If the opened file no longer exists, direct Save MUST NOT create a file at the old location and MUST NOT present a location dialog." US3 scenario 2 says the document stays unsaved. FR-009 is unqualified, and the spec's "Opened file" entity includes files opened from the folder explorer, so it reads as covering folder files. Spec 069 also says in-folder saving is "unchanged" and "stays as a regression check", however, and FR-003 separately says in-folder Save MUST keep writing that file, which is the clearest textual conflict with FR-009's no-create rule. The concrete inconsistency is in `specs/archive/069-save-opened-file/contracts/save-opened-file.md`: the no-create rule applies only to `file:writeOpened`, while in-folder saves use `file:write`, which creates a missing file. The e2e test (`save-opened-file.spec.ts`, "direct Save of a deleted opened file does not recreate it or ask for a location") only covers a file opened outside a folder. Spec 008's artifacts define the dialog text and buttons (in `contracts/renderer.md`) but not what a later direct Save does.

Resolved by the independent Windows run: the delete variant behaves like the rename variant (S10), so it is a failure, not an unknown. The tree omission was still present 3 seconds after Save; the code trace in section 10 suggests it persists until the folder is refreshed, but that was not proven beyond 3 seconds. The in-app delete flow was not part of this run; `tests/e2e/organize.spec.ts` covers a clean open file and the refusal to delete a dirty one (section 9).

## 6. Test case catalogue

Result key: Pass, Fail (reproduced bug), Partly (some expected behaviour held; the rest is a reported failure), Not run, Existing (covered by a current e2e spec and not re-run here). All cases start from a fresh app and the fixtures in section 4 unless stated.

### Happy path

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| H1 | No folder. Open File `dir/a.md`, type, Save | Same file saved, no Save As dialog, tab clean | Pass |
| H2 | Open Folder `dir`, click `a.md`, type, Save | `dir/a.md` saved in place | Pass (also covered by e2e) |
| H3 | Launch with `dir/a.md` as argument, type, Save | Opens as a document, saved in place | Pass |
| H4 | App running, second instance launched with `dir/a.md`, type, Save | Primary instance opens it, no second window, saved in place | Pass |
| H5 | Open Folder `dir`, Open File `other/x.md`, type, Save | `x.md` saved, tree unchanged | Pass |
| H6 | Open `a.md`, edit it, then open `b.md` in a new tab (double-click or the new-tab setting), switch to `b.md`, Save | Only `b.md` written, `a.md` still dirty | Pass |
| H7 | Edit both, Save each in turn | Each file contains only its own text | Pass |
| H8 | Open `dir/a.md` (dirty), then `dir2/a.md` with Open File | Two tabs, edits and saves go to their own files | Pass |
| H9 | Dirty tab, open the same folder again | Tab and edits kept, no duplicate tree rows | Pass |
| H10 | Rename an open dirty file in the explorer, then Save | Tab follows the rename, old name not recreated | Pass |
| H11 | Copy an open file outside the app | New file appears in the explorer within the 2.5 s the script waits; opening it gives its own tab and independent saves | Pass |
| H12 | Folder open. Open `a.md` from the explorer (dirty), then Open File on the same path | Existing tab activated, edits intact | Pass |
| H13 | Folder open. Open File `a.md` (dirty), then click it in the explorer | Existing tab activated, edits intact | Pass |
| H14 | Dirty `a.md` open. Open the same file again by OS open, by symlink path, by a path containing `..`, and by repeated OS open | One tab, edits intact | Pass |
| H15 | Dirty tab, switch to another folder, choose Save All | File saved, tabs handled per spec | Partly: saved, but see S5 |

### Sad path

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| S1 | F1 steps | One tab | Fail |
| S2 | Open folder `dir`. Open File `other/x.md` (dirty). Open folder `other`. Click `x.md` | One tab | Fail |
| S3 | Open File `a.md` (dirty). Open folder `dir`. Open File `a.md` again | One tab | Fail (reported by the accuracy review's re-run) |
| S4 | F2 steps, clean tab | Clicking `dir2/a.md` shows and saves `dir2/a.md` | Fail |
| S5 | F2 with a dirty tab, choose Save All | Same as S4 | Fail |
| S6 | F2 with a dirty tab, choose Discard | Tabs closed or rebound, clicking `dir2/a.md` shows its own content | Not run |
| S7 | F2 with a dirty tab, choose Cancel | Folder does not change, tab unchanged | Pass |
| S8 | F3 steps | One tab | Fail |
| S9 | F4 steps, rename | Save with the location dialog cancelled does not create `a.md` | Fail |
| S10 | F4 with a delete instead of a rename | Same as S9 | Fail (reproduced on Windows; section 12) |
| S11 | Overwrite an open dirty file externally, then Save | "modified by another program" prompt appears before Save, no silent overwrite | Pass (harness chose Keep my version) |
| S12 | As S11 but choose `Reload from Disk` | Disk version loaded, edits discarded only after that choice | Existing (`tabs.spec.ts`) |
| S13 | OS open of a `.txt` file | Refused, session unchanged | Existing |
| S14 | OS open of a missing path | Quiet failure, session unchanged | Existing |
| S15 | Save a never-saved document, cancel the location dialog | Stays dirty, nothing created | Existing |
| S16 | Save to a read-only file | Document stays dirty, failure shown, file not truncated | Not run (unit coverage for opened files) |
| S17 | Save As onto an existing file, then cancel | Overwrite confirmation, cancel leaves the old association | Not run |
| S18 | Open File and Open Folder with the same path via Recent Items, with a case-variant path | One tab | Not run |

## 7. Spec seeds

Each seed is intended as input to `/speckit.specify`. No technology appears here.

### Proposed spec A: One tab per file, whichever way it was opened

Input: A file is always represented by one tab, however and in whatever order it was opened.

User stories:
- P1: As a user who opens a file and later opens its folder, I get one tab, so my edits cannot be overwritten by a second tab of the same file.
- P1: As a user who opens the same file by menu, explorer, OS open or a recent entry, I get one tab.
- P2: As a user on a case-insensitive filesystem, `a.md` and `A.md` are the same file.

Scenarios:
- Given a file opened with no folder open and unsaved edits, When the user opens its containing folder and clicks the file in the explorer, Then the existing tab is activated, no second tab appears, and the unsaved text is unchanged.
- Given a file open in the explorer route with unsaved edits, When the user chooses it again with Open File, Then the existing tab is activated and the unsaved text is unchanged.
- Given a file open with unsaved edits, When the same file is opened using a path that differs only in letter case on a case-insensitive filesystem, Then the existing tab is activated.
- Given a file open with unsaved edits, When it is opened again by OS open, a symlink or a path with `..`, Then the existing tab is activated.

Requirements: Each file has at most one open tab. Two paths that name the same file are the same file. Opening an already open file never changes its unsaved content.

Success criteria: In every route and order combination of section 6 (H12 to H14, S1 to S3, S8), the number of tabs for the file is 1 and the unsaved text is unchanged.

Edge cases: files reached through Recent Items (S18, not run); Windows drive-letter case and path separators (not tested).

Assumptions: sameness follows the filesystem (Q4), so case-sensitive filesystems keep case-variant files as separate tabs.

### Proposed spec B: Tabs stay bound to their own file across folder changes

Input: A tab always shows and saves the file it was opened from, even after the user opens a different folder.

User stories:
- P1: As a user who switches folders, clicking a file in the new folder shows that file, not a tab from the previous folder.
- P1: Saving never writes one folder's content into another folder's file.
- P2: After Save All on a folder switch, the saved tabs are still correct.

Scenarios:
- Given a clean tab for `a.md` from folder one, When the user opens folder two and clicks its `a.md`, Then folder two's `a.md` content is shown.
- Given the same state, When the user edits and saves, Then folder two's `a.md` contains the user's edit applied to its own content, and folder one's `a.md` is unchanged.
- Given a dirty tab when the user opens another folder, When the user chooses Save All, Then the same two outcomes hold.
- Given a dirty tab when the user opens another folder, When the user chooses Cancel, Then the folder does not change and the tab is unchanged.

Requirements: When the user opens a different folder, all open tabs close, as in the reporter's Q1 decision (modelled on Visual Studio Code but not independently verified). If any tab has unsaved changes, the existing confirmation (Save All, Discard, Cancel) appears first, and Cancel leaves the folder and all tabs unchanged. Tabs for files opened outside any folder also close. A tab never shows or saves a file other than the one it was opened from.

Added scenario: Given tabs open from folder one, When the user opens folder two and confirms if asked, Then no tab from folder one remains and clicking folder two's `a.md` shows folder two's content.

Success criteria: In S4 and S5, folder two's `a.md` content is never replaced by folder one's content.

Edge cases: the Discard choice (S6, not run); tabs for files outside any folder.

### Proposed spec C: Save never silently recreates a file removed outside the app

Input: When an open file has been renamed or deleted outside the app, Save does not create a file at the old path without the user choosing to.

User stories:
- P1: As a user whose open file was renamed in Finder, Save does not silently recreate the old name.
- P2: Any file the app writes is visible in the explorer.

Scenarios:
- Given an open dirty file renamed outside the app, When the user chooses Save and cancels the location dialog, Then no file is created at the old path and the document stays unsaved.
- Given the same state, When the user chooses Save As and picks a location, Then the file is written there and the document becomes that file.
- Given the same state with a delete instead of a rename, Then the same outcomes hold.

Requirements: the tab shows a deleted-from-disk warning and keeps its content (Q2). Spec 069 FR-009 is already unqualified and its "Opened file" entity includes explorer opens, so the no-create rule reads as covering folder files. The concrete inconsistency is in spec 069's contract (`contracts/save-opened-file.md`), which applies the no-create rule only to `file:writeOpened`; in-folder saves use `file:write`, which creates a missing file. Spec C therefore also replaces FR-003's in-folder keep-writing rule for the removed-file case. Save on that tab opens Save As (Q3); cancelling leaves the document dirty and writes nothing. This intentionally replaces FR-009's "MUST NOT present a location dialog" for the removed-file case.

Success criteria: In S9 and S10, the folder contains no file at the old path after Save and cancelling the location dialog, and the document is still dirty.

Edge cases: user cancels Save As; the file is removed while closed tabs still exist; folder is read-only.

## 8. Open questions

Q1 to Q4 change user-visible behaviour and were decided by the reporter on 2026-11-20; Q5 resolves how the duplicate files were made.

**Q1. DECIDED (reporter, 2026-11-20): when the folder changes, old tabs close, as Visual Studio Code does.** The existing unsaved-changes confirmation stays and runs first. Assumption to confirm in the spec: this includes tabs for files opened outside any folder, and Visual Studio Code's own hot-exit restore of unsaved work is not copied. The Visual Studio Code behaviour was not verified against its current documentation. Current code does not yet include outside-folder tabs in that prompt: `dirtyWorkspaceRelativeDocs` in `src/renderer/hooks/useWorkspaceFolder.ts` (about lines 32 to 38) only collects dirty tabs with a workspace-relative path, so a dirty tab for a file outside any folder does not trigger the confirmation.

**Q2. DECIDED (reporter, 2026-11-20): follow Visual Studio Code.** A file removed outside the app keeps its open tab and content (the canvas is not blanked), and the tab shows a deleted-from-disk warning, for files inside the open folder as well as files opened outside it. Spec 069 FR-009 is already unqualified and its "Opened file" entity includes explorer opens, so spec C applies FR-009 to folder files and aligns FR-003, the 069 contract and the renderer with it. The Visual Studio Code behaviour in this area, including its exact styling (strikethrough, a "(deleted from disk)" suffix), was not verified. For files inside the open folder the `!` marker and dialog already exist; detecting removal of a file opened outside any folder would be new behaviour.

**Q3. DECIDED (reporter, 2026-11-20): Save opens the Save As dialog.** The tab keeps its content and shows the deleted-from-disk warning (Q2). When the user chooses Save on that tab, the Save As dialog appears instead of writing to the old path. Choosing a location writes the file there and the document becomes that file. Cancelling leaves the document dirty and writes nothing. Spec 069 FR-009 and US3 scenario 2 stay valid for the no-recreate part. FR-009's wording "MUST NOT present a location dialog" is replaced for this case and must be amended in spec C.

**Q4. DECIDED (reporter, 2026-11-20): rely on the operating system.** Two paths are the same file when the filesystem says they are, so `a.md` and `A.md` are one tab on a case-insensitive filesystem and two tabs on a case-sensitive one. The edge case is not the open itself, which the operating system allows without a warning. It is the app comparing the two path strings to decide whether the file is already open. Routes that can supply a differently cased path: Recent Items, OS open, and a typed path in the file dialog. Independently observed on Windows NTFS: `fs.realpathSync` preserved the caller's letter case, while `fs.realpathSync.native` returned the on-disk case for the same file.

**Q5. RESOLVED:** the reporter duplicated files with the operating system's Finder or Explorer, not in the app. See section 1.

## 9. Not run or inconclusive

Not run: Save As and never-saved flows beyond the existing e2e coverage; read-only targets; CRLF, frontmatter and large-file round trips; restore on relaunch and the quit confirmation; the Discard choice on a folder switch; Recent Items with case variants; macOS `open-file` before the window is ready; a copy placed in a subfolder (a click on the folder row did not expand it in the script).

The exploration's in-app delete attempt was inconclusive because the confirmation stub answered the wrong dialog. The flow itself is e2e-covered in `tests/e2e/organize.spec.ts`: a clean open file is deleted and its tab closes, while a dirty open file is refused. This is not the external delete in S10, which now fails.

The original run did not test Windows or Linux, and did not drive the real Finder or Explorer UI. An independent Windows run (section 12) reproduced F1 to F4. Linux, real Finder and real Explorer remain untested.

## 10. Plan notes

Background for `plan.md`. Do not copy into `spec.md`. Items marked "review" were established by the accuracy reviewer's reading or re-run.

- `handleOpenExisting` in `src/renderer/state/documents.ts` (lines 212 to 221) treats a document as already open when `d.path === value.path` (workspace-relative, so `"a.md"` in any folder), or, only when the incoming `path` is null, when the `canonicalPath` values match. This explains F1 (outside file has `path: null`, later arrives with `path: "a.md"`) and F2 (the same relative string in two folders).
- Explorer reads (`readFile` in `src/main/fs/read.ts`, lines 44 to 67) return no `canonicalPath`, so a tab opened from the explorer has none at open time and during plain saves (review). Save As can attach one later (`src/renderer/hooks/useDocumentSession.ts`, lines 181 to 195), so "never" would be too strong.
- Once a folder is open, `openFileFromPath` in `src/main/ipc/handlers/context.ts` (lines 207 to 247; inside-folder branch at 215 to 225) returns the relative `path` for files inside it, which is why Open File duplicates in S3 when the earlier tab was opened with no folder (review). If the earlier tab was itself opened from the explorer, both sides hold the same relative string and dedupe correctly (H12, H13).
- Folder switching replaces only explorer state (`src/renderer/hooks/useWorkspaceFolder.ts`, lines 49 to 64) and never closes or rebinds documents, so old tabs keep a relative `path` with no folder identity. `saveDocumentNow` writes that relative path at `src/renderer/hooks/useDocumentSession.ts`, lines 139 to 141; line 162 is the separate canonical-path branch, not the relative write. `openWithDecision` repeats the path-only check at line 466 (function at 458 to 481, review).
- `canonicalPath()` in `src/main/ipc/handlers/context.ts` (lines 199 to 205) uses `fs.realpathSync`. It preserves the caller's letter case, consistent with the original macOS F3 result and observed again on the case-insensitive Windows 11 NTFS volume; `fs.realpathSync.native` returned the on-disk case and is a candidate fix. The non-native behaviour is inferred from the observation, not checked in the Node source.
- `file:write` calls `suppressWatch` for the written path before writing (`src/main/ipc/handlers/files.ts`, lines 83 to 105, suppress call at line 93). The watch suppression lasts 2 seconds after the last matching event (`src/main/fs/watch.ts`, lines 95 to 115) and loaded folders are not re-read (`src/renderer/hooks/useWorkspaceTree.ts`, lines 106 to 110), so the missing tree row is likely session-persistent rather than a 1-second delay. That permanence was not proven beyond 3 seconds.
- F4's recreate is not caused by `suppressWatch`. `saveDocumentNow` takes the `live.path` branch without checking the document's external state (`src/renderer/hooks/useDocumentSession.ts`, lines 139 to 141), and `writeFile`/`atomicWrite` create the missing file (`src/main/fs/write.ts`, lines 21 to 31; `src/main/fs/atomicWrite.ts`, lines 5 to 37). `suppressWatch` explains only why the recreated file stays out of the tree.
- Other renderer sites compare document paths by string and would need the same fix: `src/renderer/hooks/useFileOpenGesture.ts` line 67, `src/renderer/hooks/useSourceViewToggle.ts` lines 148 to 150 and 192 to 194, and external-change routing in `src/renderer/App.tsx` lines 241 to 244 and `src/renderer/hooks/useDialogQueue.ts` line 35.
- The folder-switch confirmation lives in `src/renderer/hooks/useWorkspaceFolder.ts` (`confirmAndCommitPrepared`, lines 66 to 135). `dirtyWorkspaceRelativeDocs` (lines 32 to 38) only collects dirty tabs with a workspace-relative path, so a dirty tab for a file outside any folder does not trigger the prompt.
- Explorer file menu commands: Open, View source, Reveal, Rename, Delete (`src/renderer/explorer/Tree.tsx`, lines 599 to 633). Directory and root menus also offer New File and New Folder (lines 611 to 616).

## 11. Evidence and work order

Scripts (not in the repository, and under a session scratch directory that may not persist): `/private/tmp/claude-502/-Users-chris-small-Documents-Github-others-markdownmeister/2ed25c6c-f595-4c93-aba7-607f659a7b08/scratchpad/explore/explore2.spec.ts` through `explore8.spec.ts` with `playwright.config.ts`, plus the reviewer's `scratchpad/review/rev.spec.ts`. Run from the repository root because the app is launched with the relative path `out/main/index.js`, for example `npx playwright test -c <scratchpad>/explore/playwright.config.ts explore3`. `explore.spec.ts` is superseded and its results were discarded. Copy the scripts into the repository if they should be kept. The scratch scripts were not present when the report was independently verified on 2026-11-22. The verification recreated the scenarios from section 5 instead.

Suggested order:
1. Spec A (F1, F3). No open questions. Removes the silent overwrite in F1.
2. Spec B (F2). Q1 is decided.
3. Spec C (F4). Q2 and Q3 are decided.
4. Extend the exploration to the remaining section 9 gaps, in particular Linux, real Finder and real Explorer behaviour. Windows case-insensitive path behaviour is covered by the independent run in section 12; drive-letter case and path separators remain untested.

Each spec's implementation needs Playwright e2e coverage under `tests/e2e/`. The regression tests should follow the numbered steps in section 5 with the first tab dirty.

## 12. Independent verification (2026-11-22)

An independent verification rebuilt the app from application source that matches `main` (the worktree also contains dependency, configuration and documentation changes) and drove it with Playwright on Windows 11 (NTFS, case-insensitive). Three verification specs reproduced the findings and the stated control cases. The Windows run agrees with the findings and controls it re-ran; the other macOS cases were not re-run.

Reproduced:
- F1: two tabs after the explorer click, and the `SECOND` edit was lost when the first tab saved.
- F2: S4 and S5 lost `dir2/a.md`'s original content and wrote `dir`'s content into it. S7 (Cancel) passed.
- F3: two tabs for `a.md` and `A.md`; the final file held only the first tab's text. `fs.realpathSync` preserved the caller's case and `fs.realpathSync.native` returned the on-disk case for the same file.
- F4: rename and delete both recreated `a.md` on Save with no further dialog. The dialog buttons were `Save As...` and `OK`, with `Save As...` as the default and `OK` as the cancel action. The recreated file was still absent from the tree after 3 seconds.
- Controls H8, H12 and H13 passed as reported.

Corrections made to this report after the run: line references, the F4 scope and its FR-003 and 069-contract evidence, the spec 008 dialog source, the F4 delete result (S10 is now a failure), the tree-omission timing, the message-box stub wording, the Q1 and Q4 notes, the section 9 coverage notes, and the additional path-comparison sites. The Discard path (S6), the replace-with-disk path (S12, existing coverage in `tabs.spec.ts`), Save As (S17), Recent Items with case variants (S18), and read-only targets (S16) were not re-run.

Not verified by the independent run: macOS and APFS-specific behaviour, Linux, real Finder or Explorer, VS Code behaviour in Q1 and Q2, Windows drive-letter case and path separators, tree-omission permanence beyond 3 seconds, and the original scratch scripts.
