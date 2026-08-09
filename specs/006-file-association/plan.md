# Implementation Plan: File Association

**Branch**: `phase-030-file-association` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-file-association/spec.md`

## Summary

MarkdownMeister becomes openable from the operating system's file browser: a
writer can right-click a `.md` / `.markdown` file or a folder and open it in the
app without launching the app first and using a file picker. The app gains
(1) an OS-native context action — a **Windows Explorer** verb registered by the
installer and a **macOS Finder** "Open With…" declaration, both labelled with the
product name, and (2) the runtime plumbing to receive the chosen path — single
instance lock, `open-file` / `second-instance` / `argv` handling — validate it in
main, and route it through the existing single-file open and two-phase folder
open flows, preserving unsaved-work confirmation and the no-duplicate-tab rule.

Crucially, **nothing here changes the user's default application for markdown
files or folders** (FR-012): the Windows installer writes per-user context-menu
verbs under `HKCU\Software\Classes` (preserving any existing default, research
R5), and the macOS build only *declares* the file/folder types in Info.plist so
the app appears as an "Open With…" candidate (research R3/R4).

## Technical Context

**Language/Version**: TypeScript 5.8, `strict` across main/preload/renderer.

**Primary Dependencies**: Electron 43 (app events, single-instance, IPC),
electron-builder ^26 (NSIS `include` + `mac.extendInfo`). No new runtime
dependency; the installer file is plain NSIS.

**Storage**: unchanged — OS-open handling adds no persisted state. The only new
"state" is the one-shot queue of OS-open requests in the main process, and the
installer's stash of which class keys it created (registry, uninstall cleanup).

**Testing**: Vitest 4 (pure `osOpen` validation, reducer dedupe) + Playwright
e2e (OS file/folder opens, second-instance, fail-closed paths). macOS packaging
cannot be built on this Windows host — the Info.plist declaration is covered by
a manual verification step (quickstart) and the runtime `open-file` handling by
unit tests on the shared validation module.

**Target Platform**: Windows (NSIS, per-user) and macOS (dmg). Linux is out of
scope per the spec (Assumptions).

**Performance Goals**: none user-visible — OS opens are one-shot, off the
keystroke path.

**Constraints**: renderer stays sandboxed with zero new filesystem capability
(Principle I); every OS-supplied path is untrusted and validated in main before
any read (Principle II); a folder OS-open replaces the workspace only through
the existing prepare→confirm→commit flow so unsaved work is never discarded
silently (Principle III); failed opens fail closed, leave the session unchanged,
and show a quiet in-context error.

**Scale/Scope**: single selected item per invocation (FR-014); multi-select is
out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Process Isolation Is Absolute | No new renderer filesystem capability: OS-opens are validated and read in main, pushed to the renderer as `OpenedFile`/`WorkspaceInfo` — exactly the data shapes the existing dialog/recent flows already send. No generic `invoke`; the preload surface grows only three fixed event subscriptions plus a ready signal. | **PASS** |
| II. Every Path Is Untrusted | Every OS path is realpath-resolved, stat-checked, and (for files) extension-checked in main before use; rejections fail closed with scrubbed messages. OS opens are absolute by nature (no workspace root to contain against) — the same validation posture the recent-items open uses (research R4 of spec 004). | **PASS** |
| III. Never Lose The User's Words | File OS-opens go through the same single-file open as File → Open (never discards). Folder OS-opens set main's pending slot and route through the renderer's existing dirty-check → confirm → commit, so unsaved work is preserved exactly as today. | **PASS** |
| IV. Calm, Predictable Editing | One-shot opens, no keystroke-path work; a burst of OS opens is serialized. Errors are quiet footer notes (no modal) unless data loss is at stake. | **PASS** |
| V. Test What Can Corrupt Or Escape | New pure validation module gets adversarial unit tests (nonexistent/`..`/symlink/unsupported-extension/`EISDIR`); the installer's registry claims get an install→assert→uninstall automated check; e2e covers the user-visible scenarios. | **PASS** |

**Post-design re-check**: no principle is violated. The Windows installer
writes only per-user shell verbs and preserves the existing default; nothing on
the open path touches saves or dirty state.

## Phase 1 Design decisions

**D1 — OS-open plumbing (main).** A new pure module `src/main/osOpen.ts`
(classify/validate/argv-extract, Electron-free) plus a thin host
`src/main/osOpenHost.ts` that wires `requestSingleInstanceLock`, `open-file`
(macOS), `second-instance`, and first-launch `argv`. Requests are queued; the
renderer signals readiness via a new `os:ready` IPC, and the queue drains then.
Single-instance is gated by `MM_SINGLE_INSTANCE !== '0'` (research R7).

**D2 — Routing to the existing flows.** Files: main calls the existing
`openFileFromPath` and pushes the `OpenedFile` to the renderer (`os:fileOpen`),
which dispatches through `session.openFileFromTree` — the same generic open as
File → Open, giving replace-clean-tab, existing-tab activation, and (with R8)
detached-file dedupe for free. Folders: main validates, sets the existing
`pendingFolderOpen` slot via a new exported `prepareFolderFromOsPath` on the
workspace handler module, and pushes `WorkspaceInfo` to the renderer
(`os:folderOpen`), which runs a new `runPreparedFolderOpen` in
`useWorkspaceFolder` — the existing prepare→confirm→commit flow minus the
prepare step. Failures push `os:openFailed` with a scrubbed message → footer
note. The workspace handler module refactors its `pendingFolderOpen` slot into
shared state (`ctx.pendingFolderOpen`) so both the IPC handler and the OS host
can set it.

**D3 — Windows registration (installer, per-user).** New `build/installer.nsh`
included via `nsis.include`, using `!macro customInstall` / `!macro
customUnInstall`. customInstall writes verbs for `.md`, `.markdown`, and
`Directory` under `HKCU\Software\Classes`, preserving the pre-existing default
per R5, with label and icon derived from the product name. customUnInstall
removes our verb keys, drops a class key it created only when it now holds no
remaining subkeys, then `SHChangeNotify`. `fileAssociations` is NOT used on
Windows (R2). Verb command: `"$INSTDIR\markdownmeister.exe" "%1"`.

**D4 — macOS registration (Info.plist).** `mac.extendInfo.CFBundleDocumentTypes`
declares the full array: `.md`/`.markdown` (via `CFBundleTypeExtensions`, role
`Viewer`, `LSHandlerRank: Alternate`) and `public.folder` (role `Viewer`,
`LSHandlerRank: Alternate`). Declared types put the app in Finder's "Open With…"
without becoming default (R3/R4). **UNVERIFIED on a Mac** — quickstart covers it.

**D5 — Product display name (FR-015).** One value in `package.json`/
`electron-builder.yml` (`productName: MarkdownMeister`). The NSIS label text is
built from electron-builder's `${PRODUCT_NAME}` define (verified 2026-08-09: it
is passed to makensis as a command-line define), and the launcher path uses
electron-builder's `${APP_EXECUTABLE_FILENAME}` define (defined as
`${PRODUCT_FILENAME}.exe` in its `common.nsh` — the installer must NOT redefine
it). The macOS `CFBundleTypeName` strings carry the same product-name value.
Verified end-to-end with a silent install→registry-assert→uninstall on the
Windows host: verbs written with the product label, defaults preserved,
cleanup exact (research R5 / quickstart §2).

**D6 — Detached-file dedupe (FR-007).** `OpenedFile` gains optional
`canonicalPath` (realpath); `openFileFromPath` populates it; `DocumentState`
stores it; `handleOpenExisting` dedupes on it (research R8).

**D7 — e2e strategy.** New `tests/e2e/file-association.spec.ts`:
- OS file open on first launch (Windows argv path) — app opens the file tab.
- OS folder open on first launch — app opens the workspace, tree visible.
- OS open while running — two Electron instances on one private user-data dir;
  the second passes a file, the first activates/opens it (FR-008), no duplicate
  session; a repeated open of an already-open file activates the existing tab
  (FR-007).
- Fail-closed paths (missing file, unsupported extension) — footer note, session
  unchanged (FR-011).
- The NSIS registry claim is asserted by an install→assert→uninstall script in
  `quickstart.md` / CI step (research R6 `/S`), since e2e runs the unpacked
  build and cannot see installer-written registry keys.

## Project Structure

### Documentation (this feature)

```text
specs/006-file-association/
├── spec.md              # Requirements (already validated, checklist green)
├── plan.md              # This file
├── research.md          # R1…R8 (web-verified + empirical)
├── data-model.md        # os-open request/response types, canonicalPath, slot
├── quickstart.md        # Manual verification (incl. macOS + NSIS install)
├── contracts/
│   └── os-open.md       # Main↔renderer OS-open contract deltas vs spec 004/008
└── tasks.md             # (/speckit.tasks)
```

### Source Code (repository root)

```text
src/main/
├── index.ts                        # + single-instance lock + osOpenHost init
├── osOpen.ts                       # NEW pure: classifyOsTarget, extractTargetFromArgv, messages
├── osOpenHost.ts                   # NEW Electron wiring: events, queue, drain, ready signal
├── ipc/handlers/workspace.ts       # pendingFolderOpen → ctx; + prepareFolderFromOsPath export
├── ipc/handlers/context.ts         # openFileFromPath populates canonicalPath
└── ipc/register.ts                 # + os:ready handler registration

src/preload/index.ts                # + onOsFileOpen/onOsFolderOpen/onOsOpenFailed + osReady()

src/shared/ipc-contract.ts          # OpenedFile.canonicalPath; OsOpenRequest types; DesktopApi+3

src/renderer/
├── state/documents.ts              # DocumentState.canonicalPath; openFile; handleOpenExisting dedupe
├── hooks/useOsOpen.ts              # NEW: subscribes os:*, routes to session/folder/dialog
├── hooks/useWorkspaceFolder.ts     # + runPreparedFolderOpen (shared confirm→commit)
└── App.tsx                         # wire useOsOpen

build/installer.nsh                 # NEW NSIS customInstall/customUnInstall
electron-builder.yml                # nsis.include; mac.extendInfo CFBundleDocumentTypes

tests/main/osOpen.test.ts           # NEW adversarial validation tests
tests/renderer/documents.*.test.ts  # + canonicalPath dedupe cases
tests/e2e/file-association.spec.ts  # NEW
tests/e2e/launch.ts                 # MM_SINGLE_INSTANCE=0 default + argv launch helper
```

**Structure Decision**: OS-open follows the repo's existing split of pure logic
(`recentItems.ts`, `scrubPaths.ts`) vs Electron wiring (`ipc/handlers/*`): the
validation is Electron-free and unit-testable, the host is thin. The
`pendingFolderOpen` slot moves from a closure to `ctx` so two entry points (IPC
and OS host) share it — the same shared-context pattern spec 017 established.

## Complexity Tracking

> Fill only if Constitution Check has violations that must be justified.

None. The one genuinely delicate piece — the Windows installer not disturbing
existing default associations — is handled by the R5 preserve-the-default
mechanism plus an automated install/assert/uninstall verification; it is an
installation-time concern, not a runtime principle violation.
