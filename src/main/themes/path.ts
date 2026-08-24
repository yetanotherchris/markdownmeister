import * as path from 'path'
import { recentItemsConfigPath } from '../recentItemsPath'

export function themesDir(): string {
  return path.join(path.dirname(recentItemsConfigPath()), 'themes')
}
