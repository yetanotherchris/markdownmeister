# Implementation Plan: Settings About Section

**Branch**: `phase-37-settings-about-section` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/037-settings-about-section/spec.md`

## Summary

The settings dialog gains a fourth, read-only About area showing the three build-identity values: the installed version, the repository URL handed to the OS browser on activation, and the full source revision the running build was produced from. Version comes from Electron's own build metadata via `app.getVersion()` (the release pipeline rewrites the packaged package.json with the tag version, so there is exactly one source of truth); the revision is injected into the main-process bundle at build time through a Vite `define`, with an explicit development-build placeholder whenever no trustworthy metadata exists. Two named preload operations carry the values to the sandboxed renderer and hand the URL to the OS; the About area itself holds no adjustable state and therefore cannot change the staged-save behaviour of the other areas.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (Electron 43 main process, React 19 renderer)

**Primary Dependencies**: None new — reuses the existing preload `contextBridge` surface, the split IPC handler modules, `shell.openExternal` (platform API), and electron-vite's `define` (research R1–R6)

**Storage**: None — build identity is embedded at build time and held in memory; nothing about About persists to config.json

**Testing**: Vitest unit tests for the build-info composition policies and the new handlers (renderer authorization rejection included); jsdom component test for area order and staged-state non-interference; Playwright e2e against the real built app including the clipboard round-trip, an `openExternal` call recorder, and the development-placeholder variant forced via `MM_BUILD_COMMIT=''`

**Target Platform**: Windows/macOS/Linux desktop (identical behaviour; the external hand-off is `shell.openExternal` on every platform)

**Performance Goals**: N/A — one IPC fetch per dialog mount, off the keystroke path

**Constraints**: Renderer stays sandboxed with a fixed list of named operations (constitution I); no fabricated metadata in unpackaged runs (FR-007); About must not perturb the staged-save model (FR-008)

**Scale/Scope**: 1 new main module, 1 new handler module, 1 new hook + 1 new renderer component, CSS additions, contract/preload/registry wiring, 4 new test files, spec artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after design: the feature adds two named operations to the fixed preload surface and no path handling.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Honoured — the renderer receives a plain `{version, revision, repositoryUrl}` object and a zero-argument `openRepositoryUrl()` operation through the contextBridge; no Node/fs/Electron reaches the renderer, and no generic invoke escape hatch is added. Both channels validate the approved renderer in main before acting |
| II. Every Path Is Untrusted | None — the feature touches no filesystem paths; the only external value is a compile-time repository-URL constant that never round-trips through the renderer |
| III. Never Lose The User's Words | Honoured — About holds no staged state (FR-008), so closing the dialog after viewing it cannot prompt or discard anything; the existing dirty/close guards are untouched |
| IV. Calm, Predictable Editing | Honoured — the URL hands off to the OS browser; the application window neither navigates nor opens internal views (the global `setWindowOpenHandler(() => deny)` and `will-navigate` guard remain in force). A denied clipboard write degrades silently |
| V. Test What Can Corrupt Or Escape | Honoured in proportion to risk — the IPC contract shape (authorization rejection on both channels, argument-free contract, exact external URL, exactly-once hand-off) is unit-tested; user-visible acceptance scenarios are e2e-tested |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/037-settings-about-section/
├── plan.md              # This file
├── research.md          # Phase 0 output: R1–R8 decisions with evidence
├── quickstart.md        # Phase 1 output: manual verification matrix
├── contracts/
│   └── preload.md       # Phase 1 output: the two new named operations
└── tasks.md             # Phase 2 output: ordered work items
```

### Source Code (repository root)

```text
electron.vite.config.ts        # EDIT: define __BUILD_COMMIT__ in the main config
src/
├── shared/
│   └── ipc-contract.ts        # EDIT: BuildInfo type + two DesktopApi operations
├── main/
│   ├── buildInfo.ts           # NEW: repository constant, revision policies, composition
│   └── ipc/
│       ├── register.ts        # EDIT: register build handlers; extend teardown list
│       └── handlers/
│           └── build.ts       # NEW: build:getInfo / build:openRepository handlers
└── renderer/
    ├── chrome/
    │   ├── SettingsDialog.tsx # EDIT: 'about' joins SettingsArea + SETTINGS_AREAS (last)
    │   ├── AboutArea.tsx      # NEW: the read-only rows
    │   └── settings.css       # EDIT: About row/link/copy styles
    └── hooks/
        └── useBuildInfo.ts    # NEW: fetch-on-mount build info
tests/
├── main/
│   ├── buildInfo.test.ts      # NEW: env override / empty env / git fallback / composition
│   └── buildHandlers.test.ts  # NEW: authorization + handler behaviour (mocked electron)
├── renderer/
│   └── settingsAbout.test.tsx # NEW: area order, stateless draft, row rendering
└── e2e/
    └── about.spec.ts          # NEW: acceptance scenarios against the built app
package.json                   # EDIT: append new/edited files to scripts.format:check
```

**Structure Decision**: Follows the established layout — electron-free domain logic in `src/main/buildInfo.ts`, thin electron-edge handlers in `src/main/ipc/handlers/build.ts` (same split as settings/files/recent), presentation in `chrome/` with its co-located stylesheet, orchestration in a named hook.

## Key Design Decisions

Full evidence in [research.md](research.md); the contract shapes in [contracts/preload.md](contracts/preload.md).

- **D1 Version**: `app.getVersion()` in the handler — the release workflow already injects the tag version into the packaged package.json (`--config.extraMetadata.version`), making it the single published source of truth (FR-002/FR-009).
- **D2 Revision injection**: `__BUILD_COMMIT__` defined in the electron-vite main config from `MM_BUILD_COMMIT` when set (empty string maps to `null`) else a guarded `git rev-parse HEAD` executed once at config load (failure → `null`). Resolution policy lives in the pure `resolveBuildRevision` so it is unit-testable without spawning processes.
- **D3 Runtime seam**: `MM_BUILD_COMMIT` in the environment is honoured only in unpackaged runs (`!app.isPackaged`), which is what lets the e2e suite drive the development-placeholder variant by *launching the built app* with `MM_BUILD_COMMIT=''`; a packaged release always displays its embedded value and can never be falsified by ambient environment variables (FR-007 honesty).
- **D4 External hand-off**: `openRepositoryUrl()` takes zero arguments; the URL exists only as a main-process constant and the handler validates nothing beyond renderer approval before calling `shell.openExternal(REPOSITORY_URL)` exactly once (FR-004).
- **D5 Statelessness**: the About branch renders from fetched read-only data and owns no drafts; the dialog's Save button continues to commit only `draftEditorTheme`, so FR-008 holds structurally rather than by special-casing.

## Complexity Tracking

> No constitution violations. The only noteworthy deviation from the bare fixed decisions is D3 (runtime `MM_BUILD_COMMIT` seam gated to unpackaged runs): the simpler alternative — honouring the environment unconditionally — could falsify the About panel of a packaged release if the variable happened to be set on a user machine, contradicting FR-007; gating by `app.isPackaged` costs one boolean check and keeps packaged metadata authoritative while preserving the required testability of the placeholder path.
