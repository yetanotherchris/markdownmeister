import * as path from 'path'

export function windowIconPath(options: {
  platform: NodeJS.Platform
  isPackaged: boolean
  resourcesPath: string
  mainDir: string
}): string | undefined {
  if (options.platform === 'darwin') return undefined
  // Windows serves the multi-size .ico so each surface picks a native frame;
  // other platforms keep the single PNG copy.
  const fileName = options.platform === 'win32' ? 'icon.ico' : 'icon.png'
  if (options.isPackaged) return path.join(options.resourcesPath, fileName)
  return path.join(options.mainDir, '../../resources', fileName)
}
