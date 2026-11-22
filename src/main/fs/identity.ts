import * as fs from 'fs'
import * as path from 'path'

function normalizeOrNull(resolve: (target: string) => string, p: string): string | null {
  try {
    return path.normalize(resolve(p))
  } catch {
    return null
  }
}

/**
 * Resolve a path to the filesystem's on-disk real path. Native realpath gives
 * the on-disk spelling and resolves links; the JavaScript implementation is the
 * fallback for filesystems where the native call is unavailable. A target that
 * cannot be resolved falls back to an absolute lexical path.
 */
export function canonicalPath(p: string): string {
  return (
    normalizeOrNull((target) => fs.realpathSync.native(target), p) ??
    normalizeOrNull((target) => fs.realpathSync(target), p) ??
    path.normalize(path.resolve(p))
  )
}
