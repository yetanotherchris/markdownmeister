import * as path from 'path'
import { recentItemsConfigPath } from '../recentItemsPath'

/**
 * Spec 036: the themes folder lives beside the shared per-user config file.
 * Resolution goes through the centralised config-dir resolver so the
 * MM_CONFIG_DIR test seam relocates themes together with settings and recent
 * items (research E5). Production callers use this; unit tests inject paths.
 */
export function themesDir(): string {
  return path.join(path.dirname(recentItemsConfigPath()), 'themes')
}
