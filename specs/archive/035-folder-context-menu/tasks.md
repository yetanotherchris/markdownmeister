# Tasks: Folder Context Menu

**Input**: Design documents from `/specs/035-folder-context-menu/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/registration.md, quickstart.md

**Tests**: Included where the repository can run them (the Linux desktop-entry module). Real Explorer/Finder/file-manager context menus cannot be driven by CI or the Playwright suite (spec Assumptions) and are verified manually per quickstart.md.

**Organization**: By user story. Windows needs only a label split (the registration and uninstall machinery exists from spec 006); macOS needs no code; Linux gains one new main-process module plus wiring.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 + 3 — Windows folder action labelled correctly, uninstall already complete (Priority: P1)

**Goal**: The `Directory` verb reads "Open in MarkdownMeister" (D5/FR-011) while file verbs keep "Open with MarkdownMeister"; uninstall removes every trace via the existing state-key record (FR-008/FR-009).

**Independent Test**: Reading the two registration scripts proves the split; the quickstart Windows scenarios prove behaviour on a real machine (manual).

### Implementation for User Story 1 + 3

- [x] T001 [US1] In scripts/installer.nsh: split the single `MM_VERB_DISPLAY` define into `MM_VERB_DISPLAY_FILE` ("Open with MarkdownMeister") and `MM_VERB_DISPLAY_FOLDER` ("Open in MarkdownMeister"); give `MM_RegisterVerbClass` a display parameter so file classes pass the file label and the `Directory` registration in `customInstall` passes the folder label. The verb key stays `${PRODUCT_NAME}` so existing uninstall removal keys are unchanged (research D5). Update the header comment to cite spec 035.
- [x] T002 [P] [US1] Mirror the same label split in scripts/open-with.ps1 (`$fileDisplay` / `$folderDisplay`, `Add-Verb` takes the display), keeping the verb name and removal logic untouched. Update the header comment.
- [x] T003 [US3] Audit uninstall coverage against FR-008/FR-009 without changing code unless a gap is found: NSIS `customUnInstall` deletes every class recorded in `OsOpenState` (which includes `Directory` from T001's macro path), then the legacy v0.1.0 keys and standard locations; Scoop `pre_uninstall` resolves current classes and removes `*`, `Directory`, and legacy extension keys. Record the audit result in the implementation PR description; any gap found is fixed there instead.

**Checkpoint**: Both scripts register one verb key with two labels; uninstall paths unchanged and provably cover folders plus files.

---

## Phase 2: User Story 2 — Linux AppImage folder action (Priority: P2)

**Goal**: Running the AppImage idempotently writes a user-level desktop entry advertising `inode/directory` with `Exec`/`TryExec` pointing at the AppImage (never touching defaults); `--remove-folder-action` removes both files and exits (research D4, contracts/registration.md).

**Independent Test**: `npm test` covers rendering, quoting of hostile paths, idempotent rewrite, icon handling, and absent-file-safe removal against a redirected XDG data home; quickstart Linux scenarios prove real file-manager behaviour (manual).

### Tests for User Story 2

> **NOTE: Write these FIRST and confirm they FAIL before implementing**

- [x] T004 [P] [US2] Create tests/main/linuxDesktopEntry.test.ts covering: XDG data-home resolution (absolute `XDG_DATA_HOME` wins, falls back to `$HOME/.local/share`, relative XDG ignored, missing home fails soft); desktop-entry rendering (`Type`, `Name`, `MimeType=inode/directory;`, quoted `Exec … %f`, bare-path `TryExec`; hostile AppImage paths — spaces, double quotes, backslashes, `%`, non-Latin characters — survive exactly); ensure writes entry+icon into a temp data home, is idempotent when nothing changed, rewrites when the AppImage moves, installs a PNG icon source into hicolor and references it by name, skips an unreadable/corrupt icon without failing the write, and reports failure when the target cannot be created; remove deletes both files, is success when files are absent, and never touches `mimeapps.list`.

### Implementation for User Story 2

- [x] T005 [US2] Create src/main/linuxDesktopEntry.ts (Electron-free, like osOpen.ts): pure render + location resolution + fail-soft ensure/remove using node:fs and the existing atomicWrite helper for entry content; Exec escaping per the desktop-entry spec (quoted argument, `\` → `\\`, `"` → `\"`, literal `%` → `%%`); icon validated by PNG signature before copying; all failures return typed results, never throw past the module boundary.
- [x] T006 [US2] Wire src/main/index.ts: handle `--remove-folder-action` BEFORE the single-instance lock request (print a one-line outcome and exit, contract CLI table); on ready, when running as an AppImage on Linux (`process.env.APPIMAGE`), best-effort ensure the entry (silent success, warn on failure — constitution IV).

**Checkpoint**: `npm test` green including the new suite; the flag works without the lock; normal launch untouched on Windows/macOS.

---

## Phase 3: User Story 2 — macOS hand-off stays declaration-only (Priority: P2)

**Goal**: No code. The spec 006 `CFBundleDocumentTypes` folder declaration enables Dock drop / `open -a` / third-party file managers (research D3).

- [x] T007 [US2] Verify electron-builder.yml still declares `public.folder` under `extendInfo.CFBundleDocumentTypes` with Viewer role and `LSHandlerRank: Alternate`; no change required. Record confirmation in the PR description.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Repository gates and spec lifecycle.

- [x] T008 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`; all four must pass (e2e covers regression only — no renderer changes, per spec Assumptions)
- [x] T009 As part of the implementation PR, archive the spec: `git mv specs/035-folder-context-menu specs/archive/035-folder-context-menu` and set its **Status** to `Archived`
- [ ] T010 Run the manual verification matrix in quickstart.md against built artifacts (Windows NSIS install/uninstall, Scoop install/uninstall, macOS hand-off routes, Linux AppImage ensure/open/remove/move/delete) and record outcomes; automated gates in T008 do not substitute for this (spec Assumptions)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1/US3)**: No prerequisites — starts immediately
- **Phase 2 (US2)**: Independent of Phase 1 (different platform/files); T004 precedes T005 (red-green); T006 depends on T005
- **Phase 3 (US2)**: Independent verification only
- **Phase 4 (Polish)**: Depends on all prior phases

### Parallel Opportunities

- T001 and T002 touch different scripts and can proceed together
- Phase 2 can start alongside Phase 1 entirely

---

## Implementation Strategy

1. T001–T003 land the Windows label split with an explicit uninstall audit
2. T004 confirms red, T005/T006 make it green
3. T008 runs the four quality gates; T009 archives the spec inside the implementation PR
4. T010 remains open until someone runs the quickstart matrix against real artifacts on each OS

## Notes

- T004 must fail before T005 lands (red → green)
- T010 is manual by nature; record evidence rather than claiming unverified success
- Commit after each task or logical group; keep structural and behavioural changes separate (Tidy First)
