import * as path from 'path'
import * as fs from 'fs'



export interface ConfigPathParts {
  /** `os.homedir()`, the user's home directory. */
  homeDir: string
  /** `process.platform`. */
  platform: NodeJS.Platform
  /** `process.env.XDG_CONFIG_HOME` (Linux only; ignored elsewhere). */
  xdgConfigHome?: string

  appDataDir?: string
}


export function universalConfigDir(parts: ConfigPathParts): string {
  if (parts.platform === 'linux' && parts.xdgConfigHome && parts.xdgConfigHome.length > 0) {
    return path.join(parts.xdgConfigHome, 'markdownmeister')
  }
  return path.join(parts.homeDir, '.config', 'markdownmeister')
}


export function universalConfigPath(parts: ConfigPathParts): string {
  return path.join(universalConfigDir(parts), 'config.json')
}


export function legacyConfigPath(parts: ConfigPathParts): string {
  if (parts.platform === 'linux') {
    const configHome = parts.xdgConfigHome && parts.xdgConfigHome.length > 0
      ? parts.xdgConfigHome
      : path.join(parts.homeDir, '.config')
    return path.join(configHome, 'markdownmeister', 'config.json')
  }
  const appDataDir = parts.appDataDir && parts.appDataDir.length > 0 ? parts.appDataDir : parts.homeDir
  return path.join(appDataDir, 'markdownmeister', 'config.json')
}

export type MigrationResult = 'nothing' | 'migrated' | 'new-wins' | 'failed'


export function migrateConfigFile(legacy: string, universal: string): MigrationResult {
  try {
    const universalExists = fs.existsSync(universal)
    if (universalExists) return 'new-wins'
    if (!fs.existsSync(legacy)) return 'nothing'
    fs.mkdirSync(path.dirname(universal), { recursive: true })
    fs.renameSync(legacy, universal)
    return 'migrated'
  } catch {
    return 'failed'
  }
}
