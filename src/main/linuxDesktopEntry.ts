import * as fs from 'fs'
import * as path from 'path'

import { atomicWrite } from './fs/atomicWrite'

/**
 * Spec 035 (research D4, contracts/registration.md): the Linux folder action.
 *
 * When the app runs as an AppImage, the main process keeps a USER-LEVEL
 * freedesktop desktop entry in sync so file managers list MarkdownMeister
 * under "Open With" for folders (`MimeType=inode/directory;`). The entry is
 * association-only: this module never writes `[Default Applications]`, never
 * touches any `mimeapps.list`, and never runs `xdg-mime` — the app must never
 * become the default folder handler. `TryExec` points at the AppImage itself,
 * so launchers auto-hide the entry once the file is deleted; no dead visible
 * entry can survive an uninstall-by-deletion.
 *
 * Everything here is Electron-free (like osOpen.ts) so the rendering rules —
 * especially Exec quoting of hostile paths — are unit-testable directly, and
 * every operation fails soft: a returned failure never blocks startup.
 */

export const PRODUCT_NAME = 'MarkdownMeister'
export const DESKTOP_ENTRY_FILE_NAME = 'markdownmeister.desktop'
/** CLI flag removing the folder action (contracts/registration.md). */
export const REMOVE_FOLDER_ACTION_FLAG = '--remove-folder-action'
const ICON_FILE_NAME = 'markdownmeister.png'
const ICON_THEME_SIZE = '256x256'
/** The only mime type this feature associates: "is a folder", nothing more. */
const FOLDER_MIME_TYPE = 'inode/directory;'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export interface FolderActionLocations {
  /** The resolved XDG data home the two paths live under. */
  dataHome: string
  entryFile: string
  iconFile: string
}

/**
 * Resolve `$XDG_DATA_HOME` per the XDG base-directory spec: an absolute
 * override wins; otherwise `$HOME/.local/share`. A relative or missing value
 * is ignored rather than guessed at. Returns null when no usable home exists
 * (the caller treats that as "no folder action possible" and moves on).
 */
export function resolveXdgDataHome(env: {
  XDG_DATA_HOME?: string
  HOME?: string
}): string | null {
  const xdgDataHome = env.XDG_DATA_HOME?.trim()
  if (xdgDataHome && path.isAbsolute(xdgDataHome)) return xdgDataHome
  const home = env.HOME?.trim()
  if (!home || !path.isAbsolute(home)) return null
  return path.join(home, '.local', 'share')
}

/** The fixed pair of files this feature owns under a data home. */
export function folderActionLocations(dataHome: string): FolderActionLocations {
  return {
    dataHome,
    entryFile: path.join(dataHome, 'applications', DESKTOP_ENTRY_FILE_NAME),
    iconFile: path.join(
      dataHome,
      'icons',
      'hicolor',
      ICON_THEME_SIZE,
      'apps',
      ICON_FILE_NAME
    )
  }
}

/**
 * Quote one Exec argument per the desktop-entry spec: a double-quoted
 * argument where `\` and `"` are escaped, plus the field-code escape for a
 * literal `%` (`%%`). Keeps spaces, quotes, backslashes, and non-Latin
 * characters byte-exact through a write → parse round trip.
 */
function quoteExecArgument(argument: string): string {
  const escaped = argument
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/%/g, '%%')
  return `"${escaped}"`
}

/** Render the desktop entry. `iconName` is omitted when no icon was installed. */
export function renderDesktopEntry(
  appImagePath: string,
  options?: { iconName?: string }
): string {
  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${PRODUCT_NAME}`,
    `Exec=${quoteExecArgument(appImagePath)} %f`,
    // TryExec is a plain string value (no field codes): the raw path makes
    // launchers hide the entry when the AppImage is gone.
    `TryExec=${appImagePath.replace(/\\/g, '\\\\')}`,
    `MimeType=${FOLDER_MIME_TYPE}`
  ]
  if (options?.iconName) lines.push(`Icon=${options.iconName}`)
  return lines.join('\n') + '\n'
}

/**
 * Find a usable icon inside an AppImage mount root (the AppDir). The AppImage
 * runtime guarantees `.DirIcon`; the other candidates cover electron-builder
 * layouts. Returns null when nothing PNG-shaped is found — the entry is then
 * written without an `Icon` key rather than half-installed.
 */
export function findAppImageIcon(mountRoot: string): string | null {
  const iconBaseName = DESKTOP_ENTRY_FILE_NAME.replace(/\.desktop$/, '.png')
  const candidates = [
    path.join(mountRoot, '.DirIcon'),
    path.join(mountRoot, iconBaseName)
  ]
  const hicolorApps = path.join(mountRoot, 'usr', 'share', 'icons', 'hicolor')
  try {
    for (const size of fs.readdirSync(hicolorApps)) {
      candidates.push(path.join(hicolorApps, size, 'apps', iconBaseName))
    }
  } catch {
    // No hicolor tree in this layout — the ordered candidates still apply.
  }
  return candidates.find(isPng) ?? null
}

export type EnsureFolderActionResult =
  | { ok: true; changed: boolean; iconInstalled: boolean }
  | { ok: false; message: string }

/**
 * Idempotently write the desktop entry (and, when `iconSource` is a readable
 * PNG, the hicolor icon) for `appImagePath`. Rewrites only when content
 * differs, so relaunching from the same location touches nothing. Fails soft:
 * any filesystem error becomes `{ ok: false }` for the caller to log.
 */
export function ensureFolderAction(input: {
  locations: FolderActionLocations
  appImagePath: string
  iconSource?: string | null
}): EnsureFolderActionResult {
  const { locations, appImagePath, iconSource } = input

  let iconName: string | undefined
  let iconInstalled = false
  if (iconSource && isPng(iconSource)) {
    try {
      fs.mkdirSync(path.dirname(locations.iconFile), { recursive: true })
      fs.copyFileSync(iconSource, locations.iconFile)
      iconName = ICON_FILE_NAME.replace(/\.png$/, '')
      iconInstalled = true
    } catch {
      // Icon installation is best-effort only; the entry still works without it.
      iconName = undefined
      iconInstalled = false
    }
  }

  const content = renderDesktopEntry(appImagePath, { iconName })
  try {
    const existing = readIfPresent(locations.entryFile)
    if (existing !== content) {
      fs.mkdirSync(path.dirname(locations.entryFile), { recursive: true })
      atomicWrite(locations.entryFile, content, 0o644)
    }
    return { ok: true, changed: existing !== content, iconInstalled }
  } catch (e: unknown) {
    return { ok: false, message: describe(e) }
  }
}

export interface RemoveFolderActionResult {
  removedEntry: boolean
  removedIcon: boolean
}

/**
 * Delete the entry and icon files (contract: absent files are success). Never
 * touches `mimeapps.list` or anything else in the applications directory.
 */
export function removeFolderAction(
  locations: FolderActionLocations
): RemoveFolderActionResult {
  return {
    removedEntry: deleteIfPresent(locations.entryFile),
    removedIcon: deleteIfPresent(locations.iconFile)
  }
}

/** Read a file's contents, or null when it does not exist (any other error throws). */
function readIfPresent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

/** Unlink a file, reporting whether it existed; absence is success, other errors rethrow. */
function deleteIfPresent(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath)
    return true
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw e
  }
}

/** A source qualifies as an icon only when its leading bytes are a PNG signature. */
function isPng(filePath: string): boolean {
  let header: Buffer
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      header = Buffer.alloc(PNG_SIGNATURE.length)
      const read = fs.readSync(fd, header, 0, PNG_SIGNATURE.length, 0)
      if (read < PNG_SIGNATURE.length) return false
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
  return header.equals(PNG_SIGNATURE)
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
