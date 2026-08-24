import { app } from 'electron'
import * as path from 'path'
import * as os from 'os'
import { universalConfigPath } from './configPath'


export function recentItemsConfigPath(): string {
  const override = process.env.MM_CONFIG_DIR
  if (override && override.length > 0) {
    return path.join(override, 'config.json')
  }
  const homeDir = os.homedir()
  if (!homeDir) {
    return path.join(app.getPath('appData'), 'markdownmeister', 'config.json')
  }
  return universalConfigPath({
    homeDir,
    platform: process.platform,
    xdgConfigHome: process.env.XDG_CONFIG_HOME
  })
}
