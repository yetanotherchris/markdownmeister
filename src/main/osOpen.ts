import * as path from 'path'
import * as fs from 'fs'

/**
 * Spec 006: classification of an OS-supplied open target (Electron-free).
 *
 * The OS hands the app a path (Explorer verb argv on Windows, the Finder
 * `open-file` event on macOS). Every such path is untrusted (Principle II):
 * it is realpath-resolved, stat-checked, and, for files, extension-checked
 * BEFORE the caller reads or opens anything. A rejected path fails closed with
 * a user-facing message that never contains the path itself (FR-011).
 *
 * This module is deliberately free of Electron so the classification rules are
 * unit-testable without the runtime.
 */

export interface OsTarget {
  kind: 'file' | 'folder'
  /** The realpath-canonical absolute path the caller will read or open. */
  absPath: string
}

export type OsTargetResult =
  | { ok: true; target: OsTarget }
  | { ok: false; message: string }

/** The extensions a file OS-open accepts (FR-001/003, spec Assumptions). */
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

/**
 * Extract the OS-supplied open target from a command line.
 *
 * Windows passes the selected item as an absolute positional argument. The argv
 * also carries the executable (argv[0]), the dev entry script
 * (`out/main/index.js`), Node/Electron loaders (`-r loader.js`, Playwright's
 * harness), Chromium switches, and, under `electron .`, a bare `'.'` that
 * must never be treated as a target. The OS always delivers an absolute path
 * (`%1` / Finder), so scanning from the end for the first arg that is absolute,
 * not a switch, and not a `.js`-family script is robust against all the extras
 * and against argv reordering (research R1). Returns `null` when there is no
 * target.
 */
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
