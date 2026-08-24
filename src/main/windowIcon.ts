import * as path from 'path'

/**
 * Spec 039 (research D3): win32/Linux take the running-window/taskbar icon
 * from this explicit BrowserWindow option; macOS inherits the bundle icns
 * instead, so it gets no per-window icon.
 *
 * In dev the file lives at <repo>/resources/icon.png next to out/main. When
 * packaged it ships via electron-builder's extraResources mapping to
 * <install>/resources/icon.png, which is exactly `process.resourcesPath`,
 * and that copy is addressed authoritatively (PR #73 review finding): an
 * __dirname-relative path would land inside app.asar and only work while
 * resources/** happens to ride unbanned inside the archive.
 */
export function windowIconPath(options: {
  platform: NodeJS.Platform
  isPackaged: boolean
  resourcesPath: string
  mainDir: string
}): string | undefined {
  if (options.platform === 'darwin') return undefined
  if (options.isPackaged) return path.join(options.resourcesPath, 'icon.png')
  return path.join(options.mainDir, '../../resources/icon.png')
}
