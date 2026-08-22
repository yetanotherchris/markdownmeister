# Implementation Plan: Folder Context Menu

**Branch**: `035-folder-context-menu` | **Date**: 2026-08-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/035-folder-context-menu/spec.md`

## Summary

Folders can already be handed to MarkdownMeister on Windows and macOS, but the Windows folder entry shares the file verb's label and its Linux story is absent, and uninstall cleanup is not verified as a whole. This feature makes the Explorer folder verb a first-class "Open in MarkdownMeister" action using the same per-user registration mechanism as the existing file verbs (spec 006), adds an opt-in Linux desktop-entry integration for the AppImage, relies on the macOS document-type declaration already shipped, and hardens uninstall so every channel removes both the folder action and the file "Open with" entries. No new runtime dependencies, no signing, no native code (Clarifications 2026-08-21).

## Technical Context

**Language/Version**: TypeScript 5.8 strict (Electron 43 main process); PowerShell 7 scripts; NSIS macro include (electron-builder)

**Primary Dependencies**: None new — reuses scripts/installer.nsh, scripts/open-with.ps1, electron-builder config, and the existing OS-open host (research D6)

**Storage**: Windows: HKCU registry keys (existing state-key pattern); Linux: `~/.local/share/applications` + `~/.local/share/icons/hicolor` (XDG); macOS: nothing new (declaration lives in the app bundle)

**Testing**: Vitest unit tests for new main-process modules (desktop-entry rendering/writing with a redirected XDG home); manual verification matrix per [quickstart.md](quickstart.md) for shell/installer/file-manager behaviour (spec Assumptions: not drivable by Playwright)

**Target Platform**: Windows 10/11 (NSIS + Scoop), macOS 13+ (DMG/zip), Linux XDG desktops (AppImage)

**Performance Goals**: N/A — registration runs at install time or once per launch, off the keystroke path

**Constraints**: No elevation (FR-012); never become the default handler (FR-009, spec 006 FR-012); uninstall removes exactly what was added (FR-008/009); unsigned releases (spec 005)

**Scale/Scope**: 2 scripts edited, 1 new main-process module + wiring, 1 new test file, spec artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: unchanged — the design adds registration metadata only; no new path, IPC, or save surface.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None — no renderer, preload, or IPC changes; the OS-open IPC contract from spec 006 is consumed as-is |
| II. Every Path Is Untrusted | Honoured — folder paths from the OS flow through the existing main-process classification/validation (`classifyOsTarget` → `prepareFolderFromOsPath`); the Linux desktop-entry writer only writes fixed XDG locations derived from environment, never renderer-supplied paths |
| III. Never Lose The User's Words | None — folder opens route through the existing confirm→commit workspace pipeline (FR-003) |
| IV. Calm, Predictable Editing | Honoured — registration is silent and best-effort at install/first-launch; no dialogs or focus stealing while editing |
| V. Test What Can Corrupt Or Escape | Honoured in proportion to risk — the new desktop-entry module is pure and unit-tested including hostile paths (spaces, quotes, non-Latin) because a malformed `Exec` line is a silent failure; Windows registry scripts are verified by the manual quickstart matrix |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/035-folder-context-menu/
├── plan.md              # This file
├── research.md          # Phase 0 output: D1–D7 decisions with evidence
├── data-model.md        # Phase 1 output: registration entities
├── quickstart.md        # Phase 1 output: manual verification matrix
├── contracts/
│   └── registration.md  # Phase 1 output: registry/desktop-entry surface + removal guarantees
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

The spec 006 contract `contracts/os-open.md` (archived) defines the OS-open IPC events; this feature consumes it unchanged and does not duplicate it.

### Source Code (repository root)

```text
scripts/
├── installer.nsh            # EDIT: folder verb label "Open in MarkdownMeister"; file verbs unchanged
├── open-with.ps1            # EDIT: same label split for the Scoop path
electron-builder.yml         # NO CHANGE (extendInfo folder declaration already shipped by 006)
src/
└── main/
    ├── index.ts             # EDIT: wire Linux desktop-entry ensure/remove on ready
    └── linuxDesktopEntry.ts # NEW: pure render + write/remove of the user-level desktop entry
tests/
└── main/
    └── linuxDesktopEntry.test.ts  # NEW: rendering, idempotency, hostile-path quoting, removal
```

**Structure Decision**: Follows the existing single-project layout. Windows registration stays in the two existing scripts (installer + Scoop share the same verb model); Linux gains one main-process module because the AppImage has no installer to do it; macOS needs no code.

## Complexity Tracking

> No constitution violations. The only notable simplification versus the original request is recorded in the spec's Clarifications (2026-08-21): top-level Windows 11 menu placement was descoped because it requires a signed identity package and a native shell extension; the standard registration mechanism used by the existing file actions was chosen instead (research D1/D2).
