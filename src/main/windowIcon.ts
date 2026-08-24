import * as path from 'path'

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
