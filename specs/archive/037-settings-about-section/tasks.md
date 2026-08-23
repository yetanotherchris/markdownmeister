# Tasks: Settings About Section

**Input**: Design documents from `/specs/037-settings-about-section/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/preload.md, quickstart.md

**Tests**: Included for every layer the repository can run: Vitest unit tests (main policies + handlers + renderer component) and Playwright e2e against the real built app. Real-browser hand-off and OS clipboard behaviour beyond the recorded stub are verified manually per quickstart.md.

**Organization**: By dependency layer, bottom-up: pure main module → IPC surface → renderer UI → e2e → gates/archive. Each task is one commit; structural and behavioural changes never mix.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 — build identity exists in main (Priority: P1)

**Goal**: The main process can answer "what am I running?" with honest values: version from Electron metadata, repository constant, revision from embedded build metadata or `null` (research R1–R4).

**Independent Test**: `npm test` proves the composition policies (env override wins, empty env → `null`, guarded git fallback) without launching Electron.

### Implementation for User Story 1

> T001 is written test-first where practical (pure functions); confirm red before green.

- [x] T001 [US1] Create src/main/buildInfo.ts: export `REPOSITORY_URL` (`'https://github.com/yetanotherchris/markdownmeister'`), `BuildInfo` re-exported from the shared contract, ambient `declare const __BUILD_COMMIT__: string | null`, and the pure policies `resolveBuildRevision(envValue: string | undefined, runGitFallback: () => string | null)` (env set wins verbatim, empty string → `null`, else fallback), `normalizeRevision(raw: unknown)` (non-string/blank → `null`, else verbatim), `effectiveRevision(embedded, runtimeEnvValue, allowRuntimeOverride)` (unpackaged runs honour a set `MM_BUILD_COMMIT`, packaged runs never), `embeddedRevision()` (typeof-guarded define read), and `currentBuildInfo(version: string, isPackaged: boolean): BuildInfo`. No electron imports (research R3/R4). Create tests/main/buildInfo.test.ts covering: env override beating the git fallback even when git fails; empty-string env → `null`; unset env → git fallback value; git failure → `null`; normalizeRevision blanks/non-strings; effectiveRevision gated by `allowRuntimeOverride`; currentBuildInfo composition carrying the exact repository constant.

**Checkpoint**: `npm test` green including the new suite; no other file touched.

---

## Phase 2: User Story 1 + 2 — the named IPC surface (Priority: P1)

**Goal**: Two new named preload operations expose the trio read-only and hand the URL to the OS exactly once, with authorization checked in main (contracts/preload.md).

**Independent Test**: `npm test` registers the handlers against a mocked electron and proves authorized/unauthorized outcomes, the exact URL, exactly-once semantics, and argument-free tolerance; `npm run typecheck` proves the shared contract compiles on both sides of the bridge.

### Implementation for User Story 1 + 2

- [x] T002 [US1] Add to src/shared/ipc-contract.ts: the exported `BuildInfo` interface and two `DesktopApi` entries — `getBuildInfo(): Promise<Result<BuildInfo>>` and `openRepositoryUrl(): Promise<Result<null>>` — documented per contracts/preload.md.
- [x] T003 [US2] Create src/main/ipc/handlers/build.ts: `registerBuildHandlers(window, ctx)` registering `build:getInfo` (authorization-first via `isAuthorizedRenderer`, then `ok(currentBuildInfo(app.getVersion(), app.isPackaged))`) and `build:openRepository` (authorization-first, then `shell.openExternal(REPOSITORY_URL)` exactly once, `ok(null)`; typed error envelope if the call throws). Zero arguments accepted and ignored on both channels (research R5/R6).
- [x] T004 [US2] Wire src/preload/index.ts: add the two named operations to the fixed `api` object using the existing `invokeResult` helper. Wire src/main/ipc/register.ts: import and call `registerBuildHandlers(window, ctx)` last, and append `'build:getInfo'` and `'build:openRepository'` to the teardown channel list so removal stays complete.
- [x] T005 [US2] Create tests/main/buildHandlers.test.ts mocking the `electron` module (first `vi.mock` use in tests/main — research R8): capture `ipcMain.handle` registrations; assert an unauthorized event yields `{ ok: false, code: 'IO', message: 'Unauthorized renderer' }` on both channels and that `shell.openExternal` is never called; assert the authorized `build:getInfo` returns the version from the mocked `app.getVersion()` plus the repository constant; assert the authorized `build:openRepository` calls `shell.openExternal` exactly once with the exact constant URL and resolves `ok(null)`; assert extra payloads are ignored rather than rejected.
- [x] T006 [US2] Edit electron.vite.config.ts: import `resolveBuildRevision` from ./src/main/buildInfo, resolve once at config load (env `MM_BUILD_COMMIT` when set, else a try/catch `git rev-parse HEAD` runner returning trimmed output or `null`), and add `define: { __BUILD_COMMIT__: JSON.stringify(revision) }` to the main section (research R2).

**Checkpoint**: `npm run typecheck` green across all three projects; `npm test` green including both new suites.

---

## Phase 3: User Story 1 + 2 — the About area in settings (Priority: P1)

**Goal**: The settings dialog's navigation ends with About; selecting it shows three read-only values with link activation and silent-degrading copy, and touching it changes nothing about staged saves (FR-001..FR-008).

**Independent Test**: jsdom component test proves area order, row rendering, placeholder text, and staged-draft non-interference; manual/e2e cover the rest.

### Tests for User Story 3

> **NOTE: Write these FIRST and confirm they FAIL before implementing**

- [x] T007 [US1] Create tests/renderer/settingsAbout.test.tsx (jsdom, `window.api` stubbed like tests/renderer/useSettingsState.test.tsx): `SETTINGS_AREAS` labels equal `['General', 'Theme', 'Markdown', 'About']` in order with `'about'` last; rendering the dialog and clicking About shows Version/Repository URL/Revision rows with the stubbed values and a Copy button; `revision: null` renders the literal `development build`; visiting About then pressing Save calls `onEditorThemeSave` zero times when nothing was staged and exactly once with the staged theme when one was staged first (FR-008 statelessness both ways).

### Implementation for User Story 1 + 2

- [x] T008 [US1] Extend src/renderer/chrome/SettingsDialog.tsx: add `'about'` to `SettingsArea` and `{ value: 'about', label: 'About' }` as the last `SETTINGS_AREAS` entry; render `<AboutArea />` as the final area branch. Create src/renderer/hooks/useBuildInfo.ts (fetch once on mount via `window.api.getBuildInfo()`, tolerant of failures) and src/renderer/chrome/AboutArea.tsx (three labelled rows: Version; Repository URL as a button/link activating `window.api.openRepositoryUrl()`; Revision full-length user-selectable wrapping within the dialog flow, Copy button calling `navigator.clipboard.writeText` with silent rejection, `development build` literal when revision is `null`). Append the About styles to src/renderer/chrome/settings.css following the existing row/fieldset patterns.
- [x] T009 [US1] Run `npx prettier --check` over every new/edited source/test file and append those files to the `scripts.format:check` list in package.json; fix any formatting findings.

**Checkpoint**: `npm test` green including T007; the dialog layout, focus trap, and other areas behave unchanged.

---

## Phase 4: User Story 1 + 2 — e2e acceptance against the built app (Priority: P1)

**Goal**: The spec's acceptance scenarios pass against the real built app: nav order, three displayed values, exact external hand-off, clipboard round-trip, zero-prompt close after About, and the forced development-placeholder variant.

- [x] T010 [US1] Create tests/e2e/about.spec.ts in the style of tests/e2e/settings.spec.ts and tests/e2e/reveal.spec.ts: launch via the shared harness; assert the settings nav lists General/Theme/Markdown/About with About last and selecting it shows the three values; assert the displayed version equals `app.getVersion()` read via `electronApp.evaluate`; stub `shell.openExternal` via `electronApp.evaluate` with call recording, activate the repository row, and assert exactly one call carrying the exact URL; click Copy and read the clipboard back inside main via `electronApp.evaluate(({ clipboard }) => clipboard.readText())`, asserting it equals the displayed revision (granting the sanitized-write permission if the environment demands it); open the dialog, visit About, close it, quit through the window-close flow and assert zero native message-box calls (FR-008); relaunch with `extraEnv { MM_BUILD_COMMIT: '' }` and assert the Revision row reads `development build`.

**Checkpoint**: `npm run test:e2e` green including the new spec.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Repository gates and spec lifecycle.

- [x] T011 Run the gates in order — `npm run lint`, `npm run typecheck`, `npm test`, `npm run check`, `npx prettier --check` (format:check list), and last `npm run test:e2e` — retrying apparent machine-contention failures up to three times; all must pass.
- [x] T012 As part of the implementation PR, archive the spec: `git mv specs/037-settings-about-section specs/archive/037-settings-about-section` and set its **Status** to `Archived`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No prerequisites — starts immediately
- **Phase 2**: T002–T006 depend on T001's module (the handler composes through it)
- **Phase 3**: T007 (red) precedes T008 (green); depends on Phase 2's preload ops
- **Phase 4**: Depends on Phases 1–3 (drives the built app end-to-end)
- **Phase 5**: Depends on all prior phases

### Parallel Opportunities

- T002 (contract types) and T001 could proceed together, but T001's exports shape T002's imports, so sequential keeps each commit self-consistent
- T007 can be written while Phase 2 lands (different tree), but must be red before T008

## Notes

- Red → green applies to T007 explicitly; T001/T005 are written alongside their implementations but their assertions are derivable directly from contracts/preload.md
- Commit after each task; keep structural and behavioural changes separate (Tidy First)
- T011 contention retries: rerun a failing gate up to 3 times before treating the failure as real
- Implementation note (2026-08-23): the `BuildInfo` interface landed in T001's commit rather than T002's so every commit typechecks standalone; T002 and T004 also shared one commit because the contract additions and the preload implementations must land atomically to keep the surface consistent (both recorded in the PR description)
