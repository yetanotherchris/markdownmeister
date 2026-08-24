import type { MenuCommand, RecentItem } from '../../shared/ipc-contract'
import { shortenPath } from '../../shared/shortenPath'

/** The platform names the chrome cares about (the renderer has no Node types). */
export type Platform = 'win32' | 'darwin' | 'linux'


export type HamburgerItem =
  | { kind: 'command'; label: string; command: MenuCommand; accelerator?: string }
  | { kind: 'recent-items' }
  | { kind: 'separator' }
  | { kind: 'action'; label: string; action: 'clear-recent' | 'settings' | 'quit' }


export const RECENT_LABEL_MAX = 60

/** Format an accelerator for the current platform (⌘ on macOS, Ctrl+ elsewhere;
 *  macOS orders modifiers ⇧ before ⌘, Windows/Linux use Ctrl+Shift+). */
export function formatAccelerator(
  combo: 'new-file' | 'open-file' | 'open-folder' | 'save' | 'save-as' | 'close-tab',
  platform: Platform
): string {
  const mod = platform === 'darwin' ? '⌘' : 'Ctrl+'
  const shift = platform === 'darwin' ? '⇧' : 'Shift+'
  const shifted = platform === 'darwin' ? shift + mod : mod + shift
  switch (combo) {
    case 'new-file':
      return mod + 'N'
    case 'open-file':
      return mod + 'O'
    case 'open-folder':
      return shifted + 'O'
    case 'save':
      return mod + 'S'
    case 'save-as':
      return shifted + 'S'
    case 'close-tab':
      return mod + 'W'
  }
}


export function hamburgerMenuStructure(platform: Platform): HamburgerItem[] {
  return [
    { kind: 'command', label: 'New File', command: 'new-file', accelerator: formatAccelerator('new-file', platform) },
    { kind: 'command', label: 'Open File…', command: 'open-file', accelerator: formatAccelerator('open-file', platform) },
    { kind: 'command', label: 'Open Folder…', command: 'open-folder', accelerator: formatAccelerator('open-folder', platform) },
    { kind: 'recent-items' },
    { kind: 'separator' },
    { kind: 'command', label: 'Save', command: 'save', accelerator: formatAccelerator('save', platform) },
    { kind: 'command', label: 'Save As…', command: 'save-as', accelerator: formatAccelerator('save-as', platform) },
    { kind: 'command', label: 'Close Tab', command: 'close-tab', accelerator: formatAccelerator('close-tab', platform) },
    { kind: 'separator' },
    { kind: 'action', label: 'Settings…', action: 'settings' },
    { kind: 'separator' },
    { kind: 'action', label: 'Quit', action: 'quit' }
  ]
}

/** The selectable Recent Items entries: folders first, then files, labels
 *  shortened like the native menu (with the same ambiguity-growing budget). */
export function recentMenuEntries(items: RecentItem[]): { label: string; item: RecentItem }[] {
  const usedLabels = new Set<string>()
  const folders = items.filter((i) => i.kind === 'folder')
  const files = items.filter((i) => i.kind === 'file')
  return [...folders, ...files].map((item) => {
    let budget = RECENT_LABEL_MAX
    let label = shortenPath(item.path, budget)
    while (usedLabels.has(label) && budget < item.path.length) {
      budget += 4
      label = shortenPath(item.path, budget)
    }
    usedLabels.add(label)
    return { label, item }
  })
}
