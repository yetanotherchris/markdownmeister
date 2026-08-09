# Tasks: File Association

**Input**: Design documents from `/specs/006-file-association/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED — AGENTS.md requires Playwright e2e specs for every
user-visible feature phase. `tests/e2e/file-association.spec.ts` covers the
runtime scenarios; adversarial unit tests cover the pure validation module; the
installer's registry claims get an install→assert→uninstall verification
(`quickstart.md`).

**Organization**: Tasks are grouped by phase.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Renderer code: `src/renderer/`, tests: `tests/renderer/`, e2e: `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The branch and the shared contract/types both sides rely on

- [x] T001 Create the implementation branch `phase-030-file-association` from clean main before any source work begins (done with the archivals of 007/008)
- [x] T002 Add `canonicalPath?: string` to `OpenedFile` in src/shared/ipc-contract.ts (research R8) with a spec-006 comment
- [x] T003 Add the `OsOpenRequest` discriminated union (file / folder / failed) and the four DesktopApi additions (`onOsFileOpen`, `onOsFolderOpen`, `onOsOpenFailed`, `notifyOsReady`) to src/shared/ipc-contract.ts

---

## Phase 2: Pure validation module

**Purpose**: The Electron-free logic that classifies and rejects OS paths

- [x] T004 Add src/main/osOpen.ts: `classifyOsTarget(absPath)` → `{ kind: 'file' | 'folder' } | { kind: 'reject'; message: string }` (realpath, stat, type checks; file extension must be `.md`/`.markdown`, case-insensitive) and `extractTargetFromArgv(argv)` → `string | null` (first non-switch arg after the entry script)
- [x] T005 Add src/main/osOpen.ts failure-message builders using the existing `sanitizeError`/`scrubAbsolutePaths` discipline (no absolute paths leak to the renderer)
- [x] T006 Add tests/main/osOpen.test.ts: adversarial cases — nonexistent path, directory-as-file, file-as-directory, unsupported extension (`.txt`), uppercase `.MD`, `..`/symlink escaping shapes, argv with switches, argv with no target

---

## Phase 3: Main wiring (blocking)

**Purpose**: single-instance + OS events → queue → validated opens

- [x] T007 Move the `pendingFolderOpen` slot in src/main/ipc/handlers/workspace.ts from a closure into `ctx` (src/main/ipc/handlers/context.ts) so both the IPC handler and the OS host share it; no behaviour change (spec 017 shared-context pattern)
- [x] T008 Export `prepareFolderFromOsPath(absolutePath)` from src/main/ipc/handlers/workspace.ts — the existing prepare validation/readDir + slot write, minus the recent-entry check (the OS host pre-validated)
- [x] T009 Populate `canonicalPath` in `openFileFromPath` (src/main/ipc/handlers/context.ts) so dialog/recent/OS opens all carry it
- [x] T010 Add src/main/osOpenHost.ts: `requestSingleInstanceLock` gated by `MM_SINGLE_INSTANCE !== '0'` (research R7); `second-instance` (Windows) and `open-file` (macOS) listeners; `argv` extraction on first launch; a serialized queue; `os:ready` renderer signal to drain; focus/restore the primary window on second-instance (FR-008)
- [x] T011 Register the `os:ready` handler in src/main/ipc/register.ts and init the OS-open host + single-instance in src/main/index.ts (before `app.whenReady()`)

---

## Phase 4: Renderer wiring (blocking)

**Purpose**: route validated OS opens through the existing session/folder flows

- [x] T012 Add `canonicalPath` to `DocumentState`, set it in `openFile`, and dedupe on it in `handleOpenExisting` (src/renderer/state/documents.ts); add reducer unit cases to tests/renderer/ (repeated detached open activates the existing tab — FR-007)
- [x] T013 Add the four preload methods (src/preload/index.ts): three `on*` event subscriptions returning unsubscribes, and `notifyOsReady` invoking `os:ready`
- [x] T014 Refactor src/renderer/hooks/useWorkspaceFolder.ts: extract the shared confirm→commit steps and add `runPreparedFolderOpen(info)` that skips the prepare step (main already set the slot)
- [x] T015 Add src/renderer/hooks/useOsOpen.ts: subscribes to the three OS events; file → `session.openFileFromTree`; folder → `folder.runPreparedFolderOpen`; failed → `dialog.showOperationError`; sends `notifyOsReady` once on mount
- [x] T016 Wire `useOsOpen` into src/renderer/App.tsx (dependency order: after session/folder/dialog)

---

## Phase 5: Packaging & platform registration

**Purpose**: Windows Explorer verb + macOS Finder declaration

- [x] T017 Add `nsis.include: build/installer.nsh` and `mac.extendInfo.CFBundleDocumentTypes` (`.md`/`.markdown` via `CFBundleTypeExtensions`, role `Viewer`, `LSHandlerRank: Alternate`; `public.folder`, role `Viewer`, `LSHandlerRank: Alternate`) to electron-builder.yml (research R3/R4)
- [x] T018 Add build/installer.nsh: `!macro customInstall` writes per-user verbs for `.md`, `.markdown`, `Directory` under `HKCU\Software\Classes` (label + icon from the product name; preserves any pre-existing `(Default)` per research R5; stashes created-class flags in `HKCU\Software\MarkdownMeister\OsOpenState`); `!macro customUnInstall` removes them + `SHChangeNotify` (research R6)
- [x] T019 Verify `${PRODUCT_NAME}` exists in the generated NSIS script (build once, grep `dist/__uninstaller.nsi`); if absent, define it locally mirroring `productName` and record the deviation in plan.md D5

---

## Phase 6: Verification (User Stories)

**Purpose**: prove US1/US2/US3 acceptance scenarios + fail-closed behaviour

- [x] T020 Add the `MM_SINGLE_INSTANCE=0` default and an argv-carrying launch variant to tests/e2e/launch.ts (research R7)
- [x] T021 Add tests/e2e/file-association.spec.ts: OS file open on first launch (tab with content); OS folder open on first launch (workspace + tree); already-running open via a second instance on a private user-data dir (FR-008, no duplicate session); repeated open of an already-open file activates the existing tab (FR-007); missing-path and unsupported-extension opens fail closed with a footer note and an unchanged session (FR-011)
- [x] T022 Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run check` — all green
- [x] T023 Run `npm run test:e2e` — new suite plus the full existing suite passes
- [x] T024 Run the quickstart.md Windows install→assert→uninstall verification and confirm the pre-existing `.md` default is unchanged (FR-012/013)

---

## Phase 7: Polish

**Purpose**: Archive the spec and ship

- [ ] T025 Move specs/006-file-association to specs/archive/006-file-association (git mv), set `**Status**: Archived`
- [ ] T026 Open the phase PR against main with the AI usage line; describe how Principles I/II/III are preserved
