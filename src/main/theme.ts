import { nativeTheme } from 'electron'
import type { Settings } from '../shared/ipc-contract'



/** Pure mapping (unit-tested): `null` (system default) → `'system'`. */
export function themeSourceForOverride(override: Settings['themeOverride']): 'system' | 'light' | 'dark' {
  return override === null ? 'system' : override
}

/** Apply the persisted override to Chromium's native theme (main only). */
export function applyThemeOverride(override: Settings['themeOverride']): void {
  nativeTheme.themeSource = themeSourceForOverride(override)
}
