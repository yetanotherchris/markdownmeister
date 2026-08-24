import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/ipc-contract'


export type ThemeMode = 'light' | 'dark'


export type ThemeChoice = 'light' | 'dark' | 'system'

/** Map the persisted override to the dialog choice: `null` (the default) is the
 *  "System default" option. */
export function themeChoiceFromOverride(override: Settings['themeOverride']): ThemeChoice {
  return override === null ? 'system' : override
}

/** Map the dialog choice back to the persisted override. */
export function themeOverrideFromChoice(choice: ThemeChoice): Settings['themeOverride'] {
  return choice === 'system' ? null : choice
}


export function effectiveThemeMode(choice: ThemeChoice, prefersDark: boolean): ThemeMode {
  if (choice === 'light') return 'light'
  if (choice === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}


export function useEffectiveTheme(choice: ThemeChoice): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() =>
    effectiveThemeMode(choice, window.matchMedia('(prefers-color-scheme: dark)').matches)
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const recompute = () => setMode(effectiveThemeMode(choice, media.matches))
    recompute()
    media.addEventListener('change', recompute)
    return () => media.removeEventListener('change', recompute)
  }, [choice])

  return mode
}
