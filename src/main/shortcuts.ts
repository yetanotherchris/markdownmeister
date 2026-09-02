import { BrowserWindow } from 'electron'
import type { MenuCommand } from '../shared/ipc-contract'


export interface ShortcutInput {
  type: string
  key: string
  control: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

/** The main-side devtools toggle, distinct from renderer `MenuCommand`s. */
export type ShortcutResult = MenuCommand | 'devtools'


export function matchShortcut(input: ShortcutInput): ShortcutResult | null {
  if (input.type !== 'keyDown') return null
  if (input.key === 'F12') return 'devtools'
  const mod = input.control || input.meta
  if (!mod || input.alt) return null
  const key = input.key.toLowerCase()

  if (input.shift) {
    if (key === 'o') return 'open-folder'
    if (key === 's') return 'save-as'
    if (key === 'i') return 'devtools'
    return null
  }

  switch (key) {
    case 'n':
      return 'new-file'
    case 'o':
      return 'open-file'
    case 's':
      return 'save'
    case 'w':
      return 'close-tab'
    case 'f':
      return 'find'
    default:
      return null
  }
}


export function registerShortcuts(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    const command = matchShortcut(input)
    if (command === null) return
    event.preventDefault()
    if (command === 'devtools') {
      window.webContents.toggleDevTools()
      return
    }
    window.webContents.send('menu:command', command)
  })
}
