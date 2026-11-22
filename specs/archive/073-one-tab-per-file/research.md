# Phase 0 Research: One Tab Per File

This document records the technical decisions behind `plan.md`. It is evidence-first: every claim about current behaviour points at the code or at a local probe. The feature fixes F1 and F3 from `exploratory-testing-report.md`; F2 and F4 remain out of scope.

## R1. Identity representation

**Decision**: The comparable file identity is the existing `canonicalPath` string on `OpenedFile` and `DocumentState`. It is an absolute path produced only by the main process from the resolved real path, in the filesystem's on-disk spelling. The renderer compares it with exact string equality and never displays it or derives it. The identity feature does not use it as an access path for a read or write. The pre-existing outside-folder save still passes it to `file:writeOpened`, whose main-side allowlist is unchanged. The `path` field remains the workspace-relative path used by `file:read` and `file:write`. The `id` field remains the tab and editor-instance key and is never used for dedupe.

**Rationale**: `canonicalPath` already exists and already flows from operating-system opens, recent items, Save As, and opened-file writes. It is already the field the reducer uses for detached-file dedupe when the incoming path is null. Reusing it avoids a second absolute-path field that could drift from the save handle. The field is already optional, which lets the comparison represent a genuinely missing identity. A new field such as `fileId` would duplicate the same string, force every producer and fixture to carry both values, and create a class of bug where Save As or rename updates one and not the other. An inode and device pair is not stable across the application's atomic save, which writes a temporary file and renames it over the target, so the inode changes on every save. Hashing the real path would hide the path from the renderer but would not add security, because the renderer already receives absolute paths for files outside the workspace and already knows the workspace root, and it would make diagnosis harder.

**Alternatives rejected**:
- A separate `fileId` field: duplicated state with no benefit over the existing canonical path.
- Device and inode identity: changes on every atomic save, is not portable across filesystems, and does not match the spec's decision that filesystem path sameness decides identity.
- A hashed identity: no security gain, harder to debug, still requires main to produce it.
- Lowercased or case-folded path: guesses case-insensitivity instead of following the filesystem, which violates FR-002 and would collapse genuinely distinct files on a case-sensitive volume.

**Evidence**: `src/shared/ipc-contract.ts:38-46` defines `OpenedFile.canonicalPath`. `src/renderer/state/documents.ts:19-25` stores it on `DocumentState`. `src/main/ipc/handlers/context.ts:199-205` currently produces it. `src/renderer/hooks/useDocumentSession.ts:181-196` stores the Save As result. `tests/renderer/documents.os-open.test.ts:53-70` already relies on canonical-path matching when the incoming path is null.

**Known limitation**: the identity is a plain string. It has no structure the renderer can verify, and it must be produced by main. If main supplies a stale or missing value, the renderer can only fall back to path equality; it cannot repair the value itself.

## R2. Realpath function and fallback

**Decision**: Implement `canonicalPath(p)` as a never-throwing chain: first `fs.realpathSync.native(p)`, then `fs.realpathSync(p)`, then `path.resolve(p)`. Normalize each successful result with `path.normalize`. Do not lowercase, case-fold, or compare basenames. Native realpath is the normal path because it returns the on-disk spelling and resolves symbolic links and `..`. Non-native realpath is the first fallback because it still resolves links when the native call is unavailable on a filesystem or virtual mount. `path.resolve` is the last resort for a target that does not exist or cannot be resolved; it returns a lexical absolute path and can miss a case variant, so it is a defined degradation rather than the expected path.

**Rationale**: The F3 cause is that `fs.realpathSync` preserves the caller's letter case on a case-insensitive filesystem. A local probe on Windows 11 NTFS on 2026-11-22 confirmed the report: for a file created as `a.md`, `fs.realpathSync` on the path spelled `A.md` returned `A.md`, while `fs.realpathSync.native` returned `a.md`. The same probe showed that a lowercased drive letter is normalized by native realpath to `C:`, so drive-letter case does not need a separate rule. Native realpath also resolves `sub\..\a.md` to the same file. Node 22's type definitions expose `fs.realpathSync.native` at `node_modules/@types/node/fs.d.ts:1543-1547`. The non-native fallback is kept because native realpath can fail on some network or virtual filesystems where the JavaScript implementation still succeeds. The last-resort `path.resolve` is safe for FR-004 because two different lexical paths never become equal; it can only fail to match a case variant, which risks a duplicate, not a wrong-file activation.

**Alternatives rejected**:
- Keep `fs.realpathSync` only: F3 remains on case-insensitive filesystems.
- Use `fs.realpathSync.native` only: no fallback when the platform call fails.
- Lowercase the real path on Windows and macOS: violates the filesystem-follows rule and would merge two distinct files on a case-sensitive APFS or NTFS volume.
- Use `path.resolve` only: does not resolve symlinks, `..` through links, or on-disk case.
- Return no identity on failure: the fallback to path equality would be equivalent, but a lexical absolute path gives callers a stable value and keeps `OpenedFile` shape uniform. The chosen chain is easier to test.

**Known limitations**:
- The on-disk-case behaviour of `fs.realpathSync.native` was verified on Windows 11 NTFS in this environment. macOS APFS was not available here. The exploratory report observed F3 on macOS with the non-native call, and the fix depends on native realpath returning the on-disk spelling there; the manual macOS check in `quickstart.md` is the confirmation step.
- If both realpath calls fail and `path.resolve` is used, a case-variant path to an existing file may not match. This is a failure of the filesystem resolution, not the normal path.
- Unicode normalization differences (NFC versus NFD) are not normalized. macOS filesystems may normalize names; the native realpath is expected to expose the on-disk form, but this was not verified in this environment.
- Windows extended-length prefixes such as `\\?\` are not specially stripped. The local probe returned an ordinary `C:\...` path; a network or long-path provider that returns a prefixed form could produce a different identity string from an ordinary path.

## R3. Identity storage and runtime guarantee

**Decision**: Keep `OpenedFile.canonicalPath?: string` and `DocumentState.canonicalPath?: string` optional at the type level. Make it a runtime guarantee that every successful main-process file-producing handler supplies it: `readFile` for `file:read`, `openFileFromPath` for Open File, recent items, and operating-system opens, and the `file:saveDialog` handler for Save As. The renderer stores the value on open and replaces it on `SAVE_SUCCESS`. When an existing tab is activated and its `canonicalPath` is missing while the incoming payload has one, backfill the value. Never clear a present identity on activation. When the incoming workspace-relative `path` differs from the stored one, replace the stored `path` and title with the incoming route, because the identity is root-independent while `path` is relative to the current root.

**Rationale**: The optional type is honest. Untitled documents have no file and therefore no identity. A document whose identity was invalidated by an in-app move has none until the next open. The spec's edge case explicitly allows a route that cannot resolve to the same file, in which case the existing behaviour applies. Making the field required would force every test fixture and every renderer mock to invent an identity and would still not represent the genuinely unresolved case. The backfill lets a tab that was opened before the field was populated, or whose identity was cleared by a move, acquire the current value without changing its content or dirty state. Rebinding `path` on activation is what keeps the save route correct across a workspace change: a tab opened as `a.md` in `dir` still has `path: "a.md"` after the root moves to `dir`'s parent, so activating it for `dir/a.md` and keeping the stale path would make the next save write `a.md` under the new root. The reverse route, an existing relative path followed by `path: null`, must rebind to the outside-workspace save path for the same reason. The outgoing and incoming paths are equal in every non-identity match, so a fallback match never rebinds.

**Alternatives rejected**:
- Require `canonicalPath` on `OpenedFile`: forces fixtures to invent values and cannot represent an unresolved path.
- Add a second field just for comparison: rejected in R1.
- Recompute identity in the renderer: the renderer has no filesystem access and cannot resolve case or links.
- Keep the stored `path` on an identity match: a tab whose relative path belongs to an earlier workspace root saves against the new root and can overwrite a different file.
- Clear `path` on a workspace change: explorer reads do not add to the opened-path allowlist, so the tab could no longer save through either route.

**Evidence**: `src/renderer/state/documents.ts:95-132` copies `canonicalPath` on open. `src/renderer/state/documents.ts:366-398` replaces it on `SAVE_SUCCESS`. `src/main/fs/read.ts:44-67` currently omits it. `src/main/ipc/handlers/context.ts:207-247` supplies it for Open File and operating-system opens. `src/main/ipc/handlers/files.ts:133-174` supplies it for Save As.

## R4. Dedupe rule and fallback semantics

**Decision**: Add a pure `sameFile(a, b)` comparison with this fixed order:

1. If both `canonicalPath` values are non-empty strings, return exact equality. If they differ, the documents are different files even when their `path` strings are equal.
2. Otherwise, if either `path` is null, return false. A null path never matches a relative path, and two null paths never match each other.
3. Otherwise, return exact equality of the two `path` strings.

The function does no case folding, basename comparison, folder-relative guessing, or fuzzy matching. An empty string is treated as a missing identity.

**Rationale**: This ordering enforces FR-002 and FR-004 at the same time. F1 is the case where one side has `path: null` and a canonical path and the other has a relative path and the same canonical path; rule 1 matches. F3 is the case where both sides have the same canonical path after native realpath; rule 1 matches on a case-insensitive filesystem and does not match on a case-sensitive one because the native paths differ. H8 is the case where two files both have relative path `a.md` but different canonical paths; rule 1 refuses the match. The path fallback exists only for documents with no identity, such as test fixtures or a document whose identity was cleared by a move. Rule 2 removes the current F1 failure mode where a null path and a relative path are compared as if they could be equal.

**Alternatives rejected**:
- Path-first comparison: the current behaviour, which causes F1 and F3.
- Compare canonical paths only when the incoming path is null: the current detached-file rule, which misses the F1 case where the incoming path is relative.
- Lowercase both paths before comparing: merges genuinely distinct files on case-sensitive filesystems.
- Compare basenames: merges different files with the same name in different folders.
- Match a null path to any relative path when one has a canonical path: creates false matches and can activate the wrong file.

**Evidence**: `src/renderer/state/documents.ts:212-221` is the current path-first check. `src/renderer/hooks/useDocumentSession.ts:458-481` repeats a path-only check at line 466. `exploratory-testing-report.md` sections 5 and 10 record F1, F3, and the H8 boundary. `tests/renderer/documents.os-open.test.ts:53-70` shows the detached-file canonical match that rule 1 generalises.

## R5. Where identity is computed

**Decision**: Compute identity only in main, in a new `src/main/fs/identity.ts` module. `readFile` computes it from the resolved real path returned by `resolveFile`. `openFileFromPath` uses the `readFile` result for the inside-workspace branch and computes it once for the outside-workspace branch. The `file:saveDialog` handler computes it after the atomic write. `file:writeOpened` continues to canonicalise its requested path only for the existing allowlist check. `file:read` returns the value as part of `OpenedFile`. No renderer or preload code computes identity, and no new IPC channel is added.

**Rationale**: The constitution requires all filesystem work in main and all paths validated there. The resolved real path used for identity is already the path that `resolveWithinRoot` validated for containment, so identity does not widen access. A single helper keeps every route consistent; computing in the renderer would require a filesystem or an absolute-path derivation from the workspace root and relative path, which cannot resolve symlinks, `..` through links, or on-disk case. Adding a `file:identity` operation would widen the preload surface for no benefit because `file:read` already reads the file. The existing `writeOpenedFile` safety check re-resolves its argument with non-native realpath and requires the result to equal the argument. Passing the native on-disk spelling keeps that equality true for ordinary paths, because the non-native call returns its input's spelling, so the write path and its allowlist need no change.

**Alternatives rejected**:
- Renderer computation from `workspace.root + path`: no filesystem access, no case or link resolution, and it duplicates main's path logic.
- Preload computation: the preload is a fixed bridge, not a resolver.
- A new `file:identity` channel: unnecessary surface; the read already produces the identity.
- Switching `resolveWithinRoot` itself to native realpath: that would change path-validation behaviour and is broader than this feature. The existing containment logic stays intact; only the identity helper uses native realpath.

**Evidence**: `src/main/fs/read.ts:44-67` is the read path. `src/main/fs/paths.ts:75-128` resolves and validates within the root. `src/main/fs/write.ts:127-139` is the existing equality check in `writeOpenedFile`. `src/main/ipc/handlers/context.ts:207-247` is `openFileFromPath`. `src/main/ipc/handlers/files.ts:64-81` is `file:read`, `83-105` is `file:write`, `107-131` is `file:writeOpened`, and `133-174` is `file:saveDialog`. `src/preload/index.ts:56-166` is the fixed API list.

## R6. Dedupe sites and how they cooperate

**Decision**: Apply the comparison at every place that decides whether a requested file is already open:

- `handleOpenExisting` in `src/renderer/state/documents.ts` is the authoritative check for every `OPEN_EXISTING` dispatch.
- `openWithDecision` in `src/renderer/hooks/useDocumentSession.ts` uses `sameFile` for its `alreadyOpen` pre-check, which decides whether the active clean tab may be replaced. If the pre-check and the reducer disagree, the reducer wins; the pre-check cannot create a duplicate because the reducer never opens a new tab for a matched identity.
- `useFileOpenGesture` uses `sameFile` with a path-only candidate for its `shouldDeferSingleClick` heuristic. This check only decides whether a single click waits for the double-click window. The actual open reads the file and goes through `openWithDecision` and the reducer, so a missing incoming identity can only cause a short delay, not a wrong activation.
- `useSourceViewToggle.openPathInSource` and `openPathInFormatted` resolve the requested path through `file:read` first, then compare the returned `OpenedFile` identity against the open documents. This removes the path-only pre-check that could activate a different folder's file. The existing live-editor lifecycle is preserved: a matched live document still goes through `flushLiveContent`, `captureContentForSwitch`, `seedSourceContext`, and `SET_VIEW`, and returning to formatted still goes through `handleReturnToFormatted`. An evicted match is reactivated through the reducer rather than the live-editor path.
- Explorer clicks, menu Open File, recent items, operating-system opens, search results, new-tab actions, and created-file opens all converge on `openFileFromExplorer` or `openFileFromTree`, which call `openWithDecision`. No route keeps a separate path-only dedupe.

**Rationale**: A single rule at the choke point prevents route drift. The pre-checks exist for UI decisions, not for the one-tab invariant, so they should use the same comparison but must not be the only guard. The reducer is synchronous and sees the current document list, so it is the correct authority. Reading the requested file before the source-view context-menu decision is necessary because that caller starts with only a workspace-relative path and cannot compare identities without the main process.

**Alternatives rejected**:
- Change only the reducer: `openWithDecision` could stage a replacement for a file that is already open, and the source-view context menu would still path-match a different folder's file.
- Make every caller read the file before opening: adds a read to every single click with no correctness gain, because the reducer already checks after the read.
- Keep the source-view path pre-check and accept the F2-style activation: violates FR-004 for a context-menu open.
- Search pending replacements as well as visible tabs: a staged replacement is not an open tab, and the spec 024 staging rules already supersede or cancel it without creating a second visible tab. The identity search covers `documents` only.

**Evidence**: `src/renderer/state/documents.ts:212-221` and `257-272` are the reducer check and staging path. `src/renderer/hooks/useDocumentSession.ts:458-481` is `openWithDecision`. `src/renderer/hooks/useFileOpenGesture.ts:54-90` is the gesture. `src/renderer/hooks/useSourceViewToggle.ts:146-208` is the source and formatted context-menu path. `src/renderer/hooks/useWorkspaceTree.ts:91-102` is the tree activate path. `src/renderer/App.tsx:218-236` is the new-tab and search-result path. `src/renderer/hooks/useMenuCommands.ts:30-59` is the menu and recent path. `src/renderer/hooks/useOsOpen.ts:16-19` is the operating-system path.

## R7. Save As, rename, and the identity lifecycle

**Decision**: `SAVE_SUCCESS` is the only place that changes a tab's identity after open. It already replaces `canonicalPath` when the payload supplies one, and the plan keeps that behaviour. After Save As, the tab represents the chosen file; opening the chosen file activates that tab, and opening the old file is an ordinary open of a different file. Plain saves keep the identity. An in-app rename or move clears the affected document's `canonicalPath` in `REROUTE_PATHS` and `UPDATE_PATH`, because the old absolute path no longer names the file. The next open of the moved file supplies the new identity and backfills it. When that open also supplies a different workspace-relative `path`, activation adopts the new route as described in R3. Folder switching and external change leave identity untouched.

**Rationale**: The spec's Save As edge case says the tab represents the chosen file after a completed Save As. Updating identity through the existing `SAVE_SUCCESS` path achieves that without changing the save flow. Clearing identity on a rename prevents a stale absolute path from matching the old file or refusing to match the new one. The path fallback covers the interval before the next open, and every in-workspace open route normalises to the real target's relative path, so an explorer click, an Open File command, a `..` path, or a symlink inside the workspace all produce the same relative path and match. The identity is recomputed and backfilled on that first open, and the incoming route becomes the tab's `path` if it differs from the stored one.

**Alternatives rejected**:
- Merge tabs when Save As targets an already-open file: this is a Save As policy change that needs a decision about dirty content and undo history, and the spec's Assumptions put Save As behaviour out of scope. The feature does not do it and records it as a limitation.
- Recompute identity in the renderer on rename: no filesystem access.
- Keep the old identity across rename: it would match the old, now-missing path and fail to match the new one.
- Reset the whole document on rename: would lose content, dirty state, and undo history.

**Evidence**: `src/renderer/state/documents.ts:366-398` updates `canonicalPath` on `SAVE_SUCCESS`. `src/renderer/hooks/useDocumentSession.ts:181-196` supplies the Save As result. `src/renderer/state/documents.ts:520-548` is `REROUTE_PATHS`. `src/renderer/hooks/useWorkspaceTree.ts:122-135` dispatches it after a successful move. `specs/archive/073-one-tab-per-file/spec.md` lines 67 and 103 record the Save As edge case and the out-of-scope save assumptions.

## R8. External-change routing

**Decision**: Leave external-change routing out of scope. `App.tsx` and `useDialogQueue` continue to match watcher events by workspace-relative path. The watcher emits paths for the open folder, and outside-folder documents have no watcher. Identity would not improve the one-tab rule, because these events do not create tabs, and changing the routing would overlap the separate F4 feature about saving a file renamed or deleted outside the app. The change must not regress the existing match: explorer-opened documents still carry `path`, and outside documents still carry `canonicalPath` but are not watched.

**Rationale**: The spec's edge case says a file deleted or renamed outside the app is outside this feature but must not crash the app or change the one-tab rule for other files. Keeping the routing path-based preserves current behaviour. A future external-change feature can move the routing to identity with its own evidence and tests.

**Alternatives rejected**:
- Route external changes by canonical identity now: requires main to resolve every watcher event and expands into F4.
- Remove the path routing: would lose reload and changed-on-disk prompts.

**Evidence**: `src/renderer/App.tsx:241-252` matches `d.path === e.path` and dispatches `EXTERNAL_CHANGE`. `src/renderer/hooks/useDialogQueue.ts:30-48` repeats the path match for queued prompts. `src/renderer/state/documents.ts:550-566` applies the external state by path. `specs/archive/073-one-tab-per-file/spec.md` lines 68 and 102 record the out-of-scope assumption.

## R9. Test strategy

**Decision**: Use four layers:

- Pure comparison tests in `tests/renderer/fileIdentity.test.ts`: both identities equal, both different, one missing with equal paths, one missing with a null path, both missing and both null, case-variant identities from main, and the rule that different identities never match even with equal paths.
- Reducer tests in `tests/renderer/documents.identity.test.ts`: OS-open then explorer-read shape, explorer-read then OS-open shape, two same-relative-path files with different identities, missing-identity fallback, backfill on activation, route rebinding when the relative path or root changes, equal paths leaving the title alone, Save As identity transition, rename identity clearing, and the spec 024 replace and activate cases with identity values.
- Main-process tests in `tests/main/identity.test.ts` and `tests/main/read.test.ts`: native realpath output, case-variant equality on a case-insensitive filesystem, distinct case variants on a case-sensitive filesystem, `..` resolution, the `path.resolve` fallback for a missing path, the non-native fallback when native is mocked to throw, and `readFile` returning the identity without changing containment behaviour.
- Playwright tests in `tests/e2e/one-tab-per-file.spec.ts`: F1, S3, F3 on a case-insensitive filesystem, the case-sensitive separation control, H12, H13, the H8 boundary, the root-change rebind, and the Save As identity transition. The suite detects filesystem case sensitivity with a probe file and skips the case-insensitive scenario on a case-sensitive filesystem. The Linux CI image is case-sensitive, so it runs the separation control and skips the case-insensitive match; Windows NTFS and default macOS APFS run the case-insensitive match manually or on a platform runner.

**Rationale**: The dangerous failures are silent overwrites, so the tests cover the route matrix and the file identity boundary, not just the reducer in isolation. The pure comparison tests pin the truth table that the implementation agent must not re-decide. The main-process tests pin the case behaviour to the filesystem rather than to a hard-coded platform rule. The e2e tests use the real built app and the existing native-dialog stubs.

**Alternatives rejected**:
- Only reducer tests: they would not prove that `file:read` supplies identity or that the real filesystem reports case variants as one file.
- Only e2e: slow, platform-dependent, and harder to diagnose a fallback or truth-table error.
- Hard-code case-insensitive behaviour by platform: wrong on case-sensitive APFS or Windows volumes configured per directory.
- Skip F3 entirely on Linux: the case-sensitive separation control is still meaningful there and guards against over-deduping.

**Evidence**: `tests/renderer/documents.os-open.test.ts`, `tests/renderer/documents.open-replace.test.ts`, and `tests/renderer/documents.save.test.ts` show the existing reducer test style. `tests/e2e/tabs.spec.ts:82-90` and `tests/e2e/open-in-current-tab.spec.ts` show the replacement and tab-count assertions. `tests/e2e/file-association.spec.ts:124-140` shows the operating-system reopen pattern. `.github/workflows/quality.yml:69-83` runs e2e only in the Linux image. `playwright.config.ts:6-19` uses one worker and a 60 second timeout.

## R10. Known limitations and assumptions

- The identity is a string produced by main. The renderer cannot recompute, validate, or repair it. If a future route forgets to supply it, the comparison falls back to path equality and can miss a case variant or a null-to-relative match.
- If both realpath calls fail and `path.resolve` is used, case-variant paths to an existing file may not match. This is a fallback failure, not the normal path.
- Unicode normalization and Windows extended-length prefixes are not normalised. The local Windows probe returned ordinary on-disk-cased paths.
- Hard links are not unified. Two hard links to one inode resolve to two different real paths, so they are two documents. The specification and the exploratory report name case variants, symlinks, and `..` paths, not hard links; this design follows the resolved real path and does not add inode identity.
- Save As onto a file that is already open in another tab can leave two tabs for that file. Merging them would be a Save As policy change with dirty-content and undo-history consequences, and the spec puts Save As behaviour out of scope. This is an explicit scope boundary, not a contradiction of the one-tab rule: the feature records the limitation rather than silently merging, and a later change can decide the merge policy.
- An in-app rename or move clears the affected identity until the next open. The path fallback covers the covered routes because an in-workspace open normalises to the real target's relative path, but a document opened through a case-variant path may not reroute on a case-sensitive path comparison. That is a pre-existing rename limitation, not a new identity rule.
- A cleared identity uses the path fallback. If the user switches folders before reopening the moved file, a different folder's file with the same relative path could match the cleared document. That is the F2 class, which is out of scope; reopening the moved file first backfills the identity and removes the ambiguity.
- Folder switching does not close or rebind tabs by itself. When the same file is next opened through a route under the current root, activation rebinds that tab's relative path and title (FR-009), so the save-routing half of F2 is fixed for that file. Closing or rebinding tabs at the moment of the folder switch remains out of scope.
- External rename and delete handling remains path-based and is the separate F4 feature. This feature does not change when a save recreates a missing file.
- A context-menu View Source or Open resolves the requested path through `file:read` first. If the file no longer exists, the action fails quietly instead of activating a stale path-matching tab. The deleted-file case is out of scope and no prompt is added.
- No user-visible identity is added. Tabs keep their titles and dirty and warning markers.
