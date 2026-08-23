# Contract: Build Info Preload Operations

Date: 2026-08-23. The two named operations this feature adds to the fixed `DesktopApi` surface (`src/shared/ipc-contract.ts`, bridged in `src/preload/index.ts`). Both follow the existing conventions: explicit request/response types, `Result<T>` envelopes, authorization checked in main, and no generic channel access.

## Types

```ts
/** Spec 037: the build identity shown in the About area. */
export interface BuildInfo {
  version: string
  /** The source revision the running build was produced from; `null` when the
   *  build carries no embedded revision metadata (development runs show the
   *  development-build placeholder instead of a fabricated value). */
  revision: string | null
  repositoryUrl: string
}
```

## `getBuildInfo()` → `build:getInfo`

```ts
getBuildInfo(): Promise<Result<BuildInfo>>
```

- **Arguments**: none. The renderer sends no payload.
- **Response**: `ok({ version, revision, repositoryUrl })` where `version` is Electron's own build metadata (`app.getVersion()` — the value the release pipeline injects into a packaged app), `revision` is the build-time-embedded commit hash or `null`, and `repositoryUrl` is the constant `https://github.com/yetanotherchris/markdownmeister`.
- **Authorization**: requests from any sender other than the approved renderer window resolve to `{ ok: false, code: 'IO', message: 'Unauthorized renderer' }` without reading build metadata.
- **Failure modes**: authorization failure only; composition cannot throw (missing metadata degrades to `revision: null`).

## `openRepositoryUrl()` → `build:openRepository`

```ts
openRepositoryUrl(): Promise<Result<null>>
```

- **Arguments**: zero. The handler validates nothing about any payload — there is deliberately nothing to validate; the URL exists only as a main-process constant and never crosses the boundary inwards.
- **Effect**: calls `shell.openExternal('https://github.com/yetanotherchris/markdownmeister')` exactly once per activation — an external hand-off to the system default browser. The application window never navigates and never renders the URL (the global deny-all `window.open` handler and navigation guard remain unchanged).
- **Authorization**: unauthorized senders are rejected as above and `shell.openExternal` is never called.
- **Response**: `ok(null)` after the hand-off is initiated; `{ ok: false, code: 'IO', message }` if the OS call throws. Repeated activation repeats the hand-off; no internal state changes.

## Registration / teardown

Both channels are registered by `registerBuildHandlers(window, ctx)` (called last, after spellcheck) and are listed in `src/main/ipc/register.ts`'s teardown array alongside every other channel, so re-registration on window recreation removes stale handlers completely.

## Guarantees

- The preload surface remains a closed list of named operations — no `invoke(channel, …)` escape hatch is added (constitution I).
- The renderer learns exactly three display strings; it receives no filesystem paths, no environment values, and no capability beyond the one URL hand-off.
- No persisted state changes: neither operation writes config.json or any other store (FR-008).
