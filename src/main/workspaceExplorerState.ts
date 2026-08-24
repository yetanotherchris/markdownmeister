import { readConfigFile } from './settingsFile'
import { updateSettings } from './settings'
import { recentItemsConfigPath } from './recentItemsPath'
import { ctx } from './ipc/handlers/context'

export function reconcileExplorerClosedWithoutWorkspace(): void {
  if (ctx.workspaceRoot !== null) return
  try {
    const config = readConfigFile(recentItemsConfigPath())
    const settings = config.settings
    if (
      settings &&
      typeof settings === 'object' &&
      (settings as Record<string, unknown>).explorerVisible === true
    ) {
      updateSettings({ explorerVisible: false })
    }
  } catch {
    // Missing or malformed recent-item data leaves the explorer unchanged.
  }
}
