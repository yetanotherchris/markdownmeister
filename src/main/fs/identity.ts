import * as fs from 'fs'
import * as path from 'path'

/**
 * Resolve a path to its real location, falling back to an absolute path when
 * the target cannot be resolved (for example, it does not exist yet).
 */
export function canonicalPath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}
