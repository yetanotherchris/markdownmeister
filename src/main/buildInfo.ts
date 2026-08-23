import type { BuildInfo } from '../shared/ipc-contract'

/**
 * Spec 037 (research R1-R4): the build identity shown in the About area.
 * Electron-free by design — every function here is pure or reads only
 * globals, so tests/main exercises the policies without mocking electron;
 * the electron edge (`app.getVersion`, `app.isPackaged`) lives in the
 * IPC handler that composes `currentBuildInfo`.
 */

/** Spec FR-003: the repository URL is constant build metadata; if the
 *  repository ever moves, updating it is part of the release process. */
export const REPOSITORY_URL = 'https://github.com/yetanotherchris/markdownmeister'

// Replaced textually by electron-vite's `define` at build time
// (electron.vite.config.ts main.define): JSON.stringify(resolvedRevision),
// i.e. a JSON string literal or the literal `null`. Absent under vitest.
declare const __BUILD_COMMIT__: string | null

/**
 * Build-time policy (research R2): an explicit MM_BUILD_COMMIT wins verbatim,
 * except empty string which maps to `null` so the development-placeholder path
 * stays testable; otherwise the git fallback decides (guarded failure → null).
 */
export function resolveBuildRevision(
  envValue: string | undefined,
  runGitFallback: () => string | null
): string | null {
  if (envValue !== undefined) return envValue === '' ? null : envValue
  return runGitFallback()
}

/** Honest display value (FR-007): blank or non-string metadata degrades to
 *  `null` — the renderer shows the development-build placeholder, never a
 *  fabricated hash. */
export function normalizeRevision(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw.trim() === '' ? null : raw
}

/**
 * Runtime policy (research R4): only unpackaged runs may consult the
 * environment override, so a packaged release always displays its embedded
 * revision and ambient variables can never falsify it. Unpackaged runs
 * (dev/e2e) force e.g. `MM_BUILD_COMMIT=''` to drive the placeholder path.
 */
export function effectiveRevision(
  embedded: unknown,
  runtimeEnvValue: string | undefined,
  allowRuntimeOverride: boolean
): string | null {
  if (allowRuntimeOverride && runtimeEnvValue !== undefined) {
    return normalizeRevision(runtimeEnvValue)
  }
  return normalizeRevision(embedded)
}

/** The value baked in at build time; `null` whenever no define exists
 *  (vitest) or the build resolved no revision (research R3). */
export function embeddedRevision(): string | null {
  return typeof __BUILD_COMMIT__ === 'undefined' ? null : normalizeRevision(__BUILD_COMMIT__)
}

/** Compose the About trio. The handler supplies Electron-owned inputs;
 *  everything honest-value-related happens through the policies above. */
export function currentBuildInfo(version: string, isPackaged: boolean): BuildInfo {
  const revision = effectiveRevision(embeddedRevision(), process.env.MM_BUILD_COMMIT, !isPackaged)
  return { version, revision, repositoryUrl: REPOSITORY_URL }
}
