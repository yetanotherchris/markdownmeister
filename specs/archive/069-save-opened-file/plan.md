# Implementation Plan: Save an Opened File in Place

**Branch**: `spec-069-save-opened-file` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/069-save-opened-file/spec.md`

## Summary

Save of an existing file asks for a location whenever the document has no workspace-relative path. That happens for Open File with no folder, for a file outside the open folder, and for the same kind of open from the recent list or the operating system. The document already carries the real path that main resolved at open time. Save will write that path through a new named operation that accepts only a real path main itself allowlisted, using the existing atomic write. Files inside the open folder keep the current workspace write. Save As still opens the location dialog, and its result becomes the next save target even when the chosen file is outside the folder.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron. The change crosses main, preload, and renderer.

**Primary Dependencies**: Electron `dialog` (already used for the location dialog) and the existing `atomicWrite` helper. No new packages.

**Storage**: The user's markdown file. An in-memory allowlist of real paths for the life of the process. Nothing new is written to settings.

**Testing**: Vitest for the new channel, the allowlist, and the renderer save decision. Playwright e2e against the built app for the click-through cases.

**Target Platform**: Windows, macOS, and Linux desktop.

**Project Type**: Desktop application (Electron main, preload, renderer).

**Performance Goals**: One save is one atomic write of the document the user already has in memory. No work on the typing path.

**Constraints**: No generic IPC escape hatch. The renderer cannot supply an arbitrary absolute path. A failed save stays unsaved and must not fall through to the location dialog. Writes stay atomic. Errors must not include absolute paths.

**Scale/Scope**: One new named channel, the save decision in the document session, and the success action that records the file the document now belongs to.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: The renderer still has no Node, `fs`, or Electron access. The new write is one named preload method, `writeOpenedFile`, backed by one channel. There is no generic invoke. PASS
- **II. Every Path Is Untrusted**: Workspace writes stay on `file:write` and `resolveWithinRoot`. The new channel writes outside the workspace root, which is a deliberate exception recorded in Complexity Tracking. Main realpath-resolves the argument, writes only when that real path is already in the allowlist it filled when it opened the file or when the user confirmed the save dialog, and writes the file descriptor it opened for that check. A missing file is not created. Adversarial tests are part of the same change. PASS with the recorded exception
- **III. Never Lose The User's Words**: Failure returns `failed`, dispatches `SAVE_FAILED`, and does not open the location dialog or clear the unsaved state. Close and quit keep their existing failure text. The opened-file write updates the checked handle rather than renaming a temp file onto the path. That is the second recorded exception. PASS with the recorded exception
- **IV. Calm, Predictable Editing**: Ordinary Save of an opened file stops opening a dialog. Save As and the first save of a never-saved document still do. No work is added on the keystroke path. PASS
- **V. Test What Can Corrupt Or Escape**: The new channel gets adversarial path tests, a missing-file test that asserts no file is created, and a failure test that leaves the target intact. The renderer test covers "canonical path saves without the dialog" and "Save As outside the folder clears the old relative path". The e2e suite covers the reproduced cases. PASS

Post-design re-check: the same gates hold. The allowlist, the existence check, and the scrubbed errors are in the contract. No gate is newly broken.

## Project Structure

### Documentation (this feature)

```text
specs/069-save-opened-file/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── save-opened-file.md
├── tasks.md             # Phase 2 (/speckit.tasks)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/main/ipc/handlers/context.ts       # allowlist of opened real paths
src/main/ipc/handlers/files.ts         # file:writeOpened; save dialog returns and allowlists the chosen real path
src/main/fs/write.ts                   # write of an already authorized absolute path through its open handle, same errno mapping as writeFile
src/preload/index.ts                   # writeOpenedFile
src/shared/ipc-contract.ts             # channel argument and DesktopApi method
src/renderer/hooks/useDocumentSession.ts  # save a canonical path in place; do not fall through to the dialog
src/renderer/state/documents.ts        # SAVE_SUCCESS can clear the relative path and store the canonical path
tests/main/                        # channel allowlist, missing file, adversarial paths
tests/renderer/useDocumentSession.save.test.tsx
tests/renderer/documents.save.test.ts  # association after success, if the reducer case is not already covered nearby
tests/e2e/save-opened-file.spec.ts
```

**Structure Decision**: The desktop app's existing main / preload / renderer split. No new package and no new process.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle II: a write whose target is outside the open folder | An opened file that is not inside the folder still has to be saved in place. Refusing every path outside the root is what forces Save into the location dialog. | Widening `file:write` to accept renderer absolute paths would let the renderer choose the target. Adopting the file's parent as the open folder would change the folder the user already has open. Keeping the dialog is the bug. The allowlist limits the write to a real path main opened or the user picked in the dialog. |
| Principle III: the opened-file write does not rename a temp file over the target | The write has to use the handle that was checked. Renaming onto the path looks the path up again, and Windows refuses that rename while the handle is open. | Renaming by path after a second realpath check leaves the substitution window the constitution forbids. A directory-relative rename is not available from Node on Windows or macOS. The handle write restores the previous bytes when the new write throws. |
