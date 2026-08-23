# Research: Settings About Section

Date: 2026-08-23. Every claim below was verified against this worktree during planning (file paths + line numbers). Each decision states the choice, the evidence, and the rejected alternatives.

## R1 — Version source of truth: `app.getVersion()` (release-injected)

**Decision**: The handler composes the version with `app.getVersion()`. No version string is hand-maintained anywhere in the feature.

**Evidence**: `app.getVersion` has zero usages in `src/` today (grep, 2026-08-23) — nothing contradicts adopting it. The release pipeline injects the tag version into the packaged app: `.github/workflows/build-release.yml:152-175` documents and runs `npx electron-builder --… --config.extraMetadata.version=${VERSION}` on all three platforms, which merges the value into the packaged app's package.json; Electron's `app.getVersion()` then returns it (the packaged main reads its own rewritten package.json). The repo's package.json currently reads 1.2.1 (`package.json:4`). This satisfies FR-002/FR-009's single-source requirement without new machinery.

**Alternatives considered**:

- *Embedding a version constant via a second define* — duplicates the release injection path and risks divergence from the published artifact. Rejected.
- *Reading package.json from disk at runtime* — fragile under asar packaging and redundant when Electron already resolves it. Rejected.

## R2 — Revision injection: Vite `define` in the electron-vite main config

**Decision**: `electron.vite.config.ts` gains `main.define = { __BUILD_COMMIT__: JSON.stringify(revision) }`. The value is resolved once at config load by the pure policy `resolveBuildRevision(process.env.MM_BUILD_COMMIT, runGitFallback)`: when the env var is set it wins verbatim, with empty string mapping to `null`; otherwise the fallback runs `git rev-parse HEAD` (trimmed), guarded so any failure yields `null`.

**Evidence**: `electron.vite.config.ts:1-43` today has no `define` step in any section. electron-vite v5's per-section config extends Vite's `UserConfig` (`node_modules/electron-vite/dist/index.d.ts:72`, `BaseViteConfig<T> extends Omit<UserConfig, 'build'>`), so `define` is typed and applied to the main bundle. The ambient declaration can live module-scoped in `src/main/buildInfo.ts` because `tsconfig.main.json` includes all of `src/main/**`; the root `tsconfig.json` does not typecheck `electron.vite.config.ts` itself (include is `src/**` + `tests/**`), and ESLint's restricted-import override for `*.config.{ts,js}` allows the config file to import `child_process` for the git call (eslint.config.mjs overrides section).

**Alternatives considered**:

- *A generated `.ts` file written before build* — extra build step and repo churn for one constant. Rejected.
- *Runtime `git rev-parse` in main* — shipped releases have no checkout to read; dishonest and failure-prone. Rejected.

## R3 — Referencing the define safely from unit-tested code

**Decision**: `buildInfo.ts` declares `declare const __BUILD_COMMIT__: string | null` and reads it exclusively through `embeddedRevision()`, which guards with `typeof __BUILD_COMMIT__ === 'undefined' ? null : normalizeRevision(__BUILD_COMMIT__)`.

**Evidence/rationale**: Vitest imports `src/main/buildInfo.ts` directly (`vitest.config.ts`: main project runs `tests/main/**/*.test.ts` in node) where no define exists — a bare reference would throw ReferenceError. The `typeof` form is safe both ways: after the textual define replacement it evaluates against the literal (`typeof null === 'undefined'` → false → normalized; `typeof "abc…"` → 'string' → normalized), and under vitest it evaluates to `'undefined'` without erroring.

**Alternatives considered**: keeping the define reference in the untested handler only — splits the composition logic away from its policy helpers and still needs the same guard. Rejected as strictly worse shape.

## R4 — Runtime seam `MM_BUILD_COMMIT`, gated to unpackaged runs

**Decision**: In addition to the build-time define, `currentBuildInfo(version, isPackaged)` honours `process.env.MM_BUILD_COMMIT` **only when `!isPackaged`**, normalizing empty strings to `null`. Packaged releases always display their embedded revision.

**Evidence/rationale**: The test plan drives the placeholder variant "by launching the built app with `MM_BUILD_COMMIT=''`" — but a define is baked at build time, so a launch-time env var can only matter if main also consults the environment. Unconditional honouring could falsify an installed release if the variable were ambient on a user machine, contradicting FR-007 ("never display incorrect values"). Gating on `app.isPackaged` costs one boolean check, matches the existing test-seam pattern (`MM_CONFIG_DIR` read at `src/main/index.ts:148`, `MM_USER_DATA_DIR` at `src/main/index.ts:31`, `MM_SINGLE_INSTANCE` consumed by the OS-open host), and keeps e2e able to force the placeholder because Playwright launches `out/main/index.js` unpackaged (`tests/e2e/launch.ts:9-15`). In unpackaged runs the embedded value is merely the developer's local HEAD, so overriding it loses no authoritative information.

**Alternatives considered**: unconditional runtime override — rejected above; building twice with different env for the two e2e variants — doubles gate time and cannot express the launch-time requirement. Rejected.

## R5 — IPC surface: two named operations on the fixed preload API

**Decision**: Add `getBuildInfo(): Promise<Result<BuildInfo>>` (channel `build:getInfo`) and `openRepositoryUrl(): Promise<Result<null>>` (channel `build:openRepository`) to `DesktopApi` and the preload bridge. `openRepositoryUrl` takes zero arguments; its handler validates nothing except renderer approval and ignores any payload entirely.

**Evidence**: The preload table lives at `src/preload/index.ts:53-154` as one object literal of named operations using the shared `invokeResult` guard with `ERROR_CODES` (`:23-51`) — the new ops reuse exactly that shape. Handler registration follows `src/main/ipc/handlers/settings.ts:14-21`'s authorization-first pattern with `isAuthorizedRenderer` (`src/main/ipc/handlers/context.ts:63-73`) and the `ok`/`err` constructors (`context.ts:52-61`). `src/main/ipc/register.ts:15-41` removes every channel before re-registering (:46-52); both new channels are appended there so teardown stays complete. Registration order places `registerBuildHandlers` last, after spellcheck.

**Alternatives considered**: a parameterized `openUrl(url)` op — would let a compromised renderer open arbitrary URLs; the URL belongs to main alone (FR-003 fixes it). Rejected. A generic invoke escape hatch — forbidden by constitution I. Rejected.

## R6 — External hand-off: `shell.openExternal(REPOSITORY_URL)` exactly once

**Decision**: The authorized `build:openRepository` handler calls `shell.openExternal(REPOSITORY_URL)` once and returns `ok(null)`; failures surface as typed errors, never in-app navigation.

**Evidence**: Shell usage precedent exists in `src/main/ipc/handlers/files.ts:263-293` (`entry:reveal` uses `shell.showItemInFolder`/`shell.openPath`); `shell.openExternal` itself has zero usages today (grep). The window already denies every `window.open` and blocks disapproved navigation (`src/main/index.ts:66-69`), so the OS hand-off is the only route out — FR-004 holds structurally. The e2e suite stubs shell APIs through `electronApp.evaluate` with call recording (`tests/e2e/reveal.spec.ts:31-42`), which is the exact harness needed to assert the exact URL and exactly-once semantics.

**Alternatives considered**: opening the URL in a hidden webContents or the main window — violates FR-004 outright. Rejected.

## R7 — Renderer About area: stateless rows in the existing dialog skeleton

**Decision**: `SettingsArea` gains `'about'` and `SETTINGS_AREAS` lists `{ value: 'about', label: 'About' }` last (after Markdown). A presentational `AboutArea` component renders three labelled rows; a `useBuildInfo` hook fetches once per dialog mount via `getBuildInfo`. The revision renders full-length, user-selectable, wrapping via `overflow-wrap`, with a Copy button calling `navigator.clipboard.writeText` and swallowing rejection silently; `revision === null` renders the literal text `development build`. The repository row is a button styled as a link that activates `openRepositoryUrl()`.

**Evidence**: `SETTINGS_AREAS` is defined at `src/renderer/chrome/SettingsDialog.tsx:31-37`; the area render branches at `:211-265` and the theme fallback at `:358-407`; staged state is solely `draftEditorTheme` (`:109-111`), committed only by the footer Save button (`:415-428`). Because About adds no state and Save keeps committing only the staged theme draft, FR-008 holds structurally — visiting About cannot arm any unsaved-changes prompt. Clipboard write from a focused document on user activation works in Chromium's sandboxed renderer; the failure path (denied/unavailable) degrades by design. Renderer unit tests stub `window.api` globally (`tests/renderer/useSettingsState.test.tsx:32-41`), which extends naturally to stubbing `getBuildInfo`.

**Alternatives considered**: fetching in `App.tsx` and passing props — pays an IPC round-trip on every launch even when settings are never opened, and threads a prop through the composition root for purely presentational data. Rejected. Storing About values in the settings cache — they are not settings and would muddy the persisted contract. Rejected.

## R8 — Testing the handlers without Electron: first `vi.mock` use

**Decision**: `tests/main/buildHandlers.test.ts` mocks the `electron` module (`vi.mock('electron', …)` providing `ipcMain.handle` capture, `shell.openExternal` spy, `app.getVersion`/`app.isPackaged`), registers the handlers against a fake window, and invokes the captured handlers with synthetic events.

**Evidence**: No existing test mocks electron — the convention so far keeps domain modules electron-free and tests pure helpers (`tests/main/ipcAuthorization.test.ts` covers `isAuthorizedRenderer` directly; `tests/main/recentHandlers.test.ts` tests extracted helpers). That convention cannot express "unauthorized renderer is rejected *by the handler*" without either mocking or refactoring handlers to take an auth predicate. Mocking at the module boundary is the smaller, more honest step: the real registration + authorization code paths execute. Recorded here because it is a first for the suite.

**Alternatives considered**: extracting an authorization-parameterized inner function per handler — reshapes production code for testing's sake and duplicates the guard every other handler performs inline. Rejected.

## References

- electron-builder `extraMetadata` usage (release version injection): `.github/workflows/build-release.yml:152-175`
- Vite `define` (build-time constant replacement): https://vite.dev/config/shared-options.html#define
- electron-vite v5 per-section config type: `node_modules/electron-vite/dist/index.d.ts`
- `shell.openExternal` (OS default-browser hand-off): https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options
- `app.getVersion()` / `app.isPackaged`: https://www.electronjs.org/docs/latest/api/app
- Clipboard write requires user activation/focus (silent-degradation rationale): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
