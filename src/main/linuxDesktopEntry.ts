import * as fs from 'fs'
import * as path from 'path'

import { atomicWrite } from './fs/atomicWrite'



export const PRODUCT_NAME = 'MarkdownMeister'
export const DESKTOP_ENTRY_FILE_NAME = 'markdownmeister.desktop'
const ICON_BASE_NAME = DESKTOP_ENTRY_FILE_NAME.replace(/\.desktop$/, '.png')
/** CLI flag removing the folder action (contracts/registration.md). */
export const REMOVE_FOLDER_ACTION_FLAG = '--remove-folder-action'
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


export function resolveXdgDataHome(env: { XDG_DATA_HOME?: string; HOME?: string }): string | null {
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
    iconFile: path.join(dataHome, 'icons', 'hicolor', ICON_THEME_SIZE, 'apps', ICON_BASE_NAME)
  }
}


function encodeExecArgument(argument: string): string {
  const quoted = `"${argument.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`
  return quoted.replace(/\\/g, '\\\\')
}

/** Render the desktop entry. `iconName` is omitted when no icon was installed. */
export function renderDesktopEntry(appImagePath: string, options?: { iconName?: string }): string {
  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${PRODUCT_NAME}`,
    `Exec=${encodeExecArgument(appImagePath)} %f`,
    // TryExec is a plain string value (no field codes): the raw path makes
    // launchers hide the entry when the AppImage is gone.
    `TryExec=${appImagePath.replace(/\\/g, '\\\\')}`,
    `MimeType=${FOLDER_MIME_TYPE}`
  ]
  if (options?.iconName) lines.push(`Icon=${options.iconName}`)
  return lines.join('\n') + '\n'
}


export function findAppImageIcon(mountRoot: string): string | null {
  const candidates = [path.join(mountRoot, '.DirIcon'), path.join(mountRoot, ICON_BASE_NAME)]
  const hicolorApps = path.join(mountRoot, 'usr', 'share', 'icons', 'hicolor')
  try {
    const byPreferredSize = (a: string, b: string): number => {
      if (a === ICON_THEME_SIZE) return -1
      if (b === ICON_THEME_SIZE) return 1
      return widthOf(b) - widthOf(a)
    }
    const sizes = fs.readdirSync(hicolorApps).sort(byPreferredSize)
    for (const size of sizes) {
      candidates.push(path.join(hicolorApps, size, 'apps', ICON_BASE_NAME))
    }
  } catch {
    // No hicolor tree in this layout, the ordered candidates still apply.
  }
  return candidates.find(isPng) ?? null
}

/** Leading pixel width of an icon-theme size directory name like `512x512`. */
function widthOf(sizeDirectoryName: string): number {
  return Number.parseInt(sizeDirectoryName, 10) || 0
}

export type EnsureFolderActionResult =
  { ok: true; changed: boolean; iconInstalled: boolean } | { ok: false; message: string }

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

  if (!appImagePath) {
    return { ok: false, message: 'No application image path was provided.' }
  }

  const iconName = ICON_BASE_NAME.replace(/\.png$/, '')
  const iconInstalled = iconSource ? installIcon(iconSource, locations.iconFile) : false

  const content = renderDesktopEntry(appImagePath, {
    iconName: iconInstalled ? iconName : undefined
  })
  try {
    const existing = readIfPresent(locations.entryFile)
    if (existing !== content) {
      fs.mkdirSync(path.dirname(locations.entryFile), { recursive: true })
      atomicWrite(locations.entryFile, content, 0o644)
    }
    return { ok: true, changed: existing !== content, iconInstalled }
  } catch (e: unknown) {
    return { ok: false, message: errorText(e) }
  }
}


function installIcon(iconSource: string, iconFile: string): boolean {
  try {
    if (!isPng(iconSource)) return false
    if (!readBytesIfPresent(iconFile)?.equals(fs.readFileSync(iconSource))) {
      fs.mkdirSync(path.dirname(iconFile), { recursive: true })
      fs.copyFileSync(iconSource, iconFile)
    }
    return true
  } catch {
    return false
  }
}

export interface RemoveFolderActionResult {
  removedEntry: boolean
  removedIcon: boolean
}


export function removeFolderAction(locations: FolderActionLocations): RemoveFolderActionResult {
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

/** Read a file's raw bytes, or null when it does not exist (any other error throws). */
function readBytesIfPresent(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath)
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

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
