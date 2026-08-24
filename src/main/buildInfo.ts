import type { BuildInfo } from '../shared/ipc-contract'




export const REPOSITORY_URL = 'https://github.com/yetanotherchris/markdownmeister'

// Replaced textually by electron-vite's `define` at build time
// (electron.vite.config.ts main.define): JSON.stringify(resolvedRevision),
// i.e. a JSON string literal or the literal `null`. Absent (undefined) under
// vitest, which embeddedRevision()'s typeof guard degrades to `null`.
declare const __BUILD_COMMIT__: string | null | undefined


export function resolveBuildRevision(
  envValue: string | undefined,
  runGitFallback: () => string | null
): string | null {
  if (envValue !== undefined) return envValue === '' ? null : envValue
  return runGitFallback()
}


export function normalizeRevision(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw.trim() === '' ? null : raw
}


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


export function embeddedRevision(): string | null {
  return typeof __BUILD_COMMIT__ === 'undefined' ? null : normalizeRevision(__BUILD_COMMIT__)
}

/** Compose the About trio. The handler supplies Electron-owned inputs;
 *  everything honest-value-related happens through the policies above. */
export function currentBuildInfo(version: string, isPackaged: boolean): BuildInfo {
  const revision = effectiveRevision(embeddedRevision(), process.env.MM_BUILD_COMMIT, !isPackaged)
  return { version, revision, repositoryUrl: REPOSITORY_URL }
}
