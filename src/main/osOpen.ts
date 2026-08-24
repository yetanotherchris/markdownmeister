import * as path from 'path'
import * as fs from 'fs'



export interface OsTarget {
  kind: 'file' | 'folder'

  absPath: string
}

export type OsTargetResult =
  | { ok: true; target: OsTarget }
  | { ok: false; message: string }


const SUPPORTED_FILE_EXTENSIONS = new Set(['.md', '.markdown'])

/**
 * Classify an OS-supplied absolute path. Returns `file` for a supported
 * markdown file, `folder` for a directory, or a scrubbed failure message.
 * Every message is path-free, so nothing here needs `scrubAbsolutePaths`.
 */
export function classifyOsTarget(absPath: unknown): OsTargetResult {
  if (typeof absPath !== 'string' || absPath.length === 0) {
    return { ok: false, message: 'The selected item could not be opened.' }
  }

  let realPath: string
  try {
    realPath = fs.realpathSync(absPath)
  } catch {
    return { ok: false, message: 'The selected file or folder is no longer available.' }
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(realPath)
  } catch {
    return { ok: false, message: 'The selected file or folder could not be read.' }
  }

  if (stat.isDirectory()) {
    return { ok: true, target: { kind: 'folder', absPath: realPath } }
  }

  if (stat.isFile()) {
    const extension = path.extname(realPath).toLowerCase()
    if (!SUPPORTED_FILE_EXTENSIONS.has(extension)) {
      return { ok: false, message: 'This file type is not supported as a markdown document.' }
    }
    return { ok: true, target: { kind: 'file', absPath: realPath } }
  }

  return { ok: false, message: 'The selected item is not a supported file or folder.' }
}


const SCRIPT_EXTENSION_RE = /\.(js|mjs|cjs)$/i

export function extractTargetFromArgv(argv: readonly string[]): string | null {
  for (let i = argv.length - 1; i > 0; i--) {
    const arg = argv[i]
    if (arg.startsWith('-')) continue
    if (!path.isAbsolute(arg)) continue
    if (SCRIPT_EXTENSION_RE.test(arg)) continue
    return arg
  }
  return null
}
