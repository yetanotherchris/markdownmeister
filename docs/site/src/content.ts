export const repositoryUrl = 'https://github.com/yetanotherchris/markdownmeister'
export const releasesUrl = `${repositoryUrl}/releases/latest`
export const storeSearchUrl = 'https://apps.microsoft.com/search?query=MarkdownMeister'
export const issuesUrl = `${repositoryUrl}/issues`
export const privacyUrl = 'privacy.html'

export const navigation = [
  ['features', 'Features'],
  ['install', 'Install'],
  ['shortcuts', 'Keyboard shortcuts'],
  ['settings', 'Settings'],
  ['privacy', 'Privacy']
] as const

export const features = [
  'WYSIWYG markdown editing with a source view when you want the raw text.',
  'A folder explorer that browses, renames, moves, creates, and deletes files.',
  'Tabbed documents that keep each file’s undo history, cursor, and scroll position.',
  'Open a folder straight from your file manager on Windows, macOS, and Linux.',
  'Light and dark appearance that follows your system, with editor themes.',
  'Plain markdown files on disk.'
] as const

export interface Shortcut {
  keys: string
  action: string
}

/** Matches src/main/shortcuts.ts. Keep the two in step. */
export const shortcuts: Shortcut[] = [
  { keys: 'Ctrl / Cmd + N', action: 'New file' },
  { keys: 'Ctrl / Cmd + O', action: 'Open file' },
  { keys: 'Ctrl / Cmd + Shift + O', action: 'Open folder' },
  { keys: 'Ctrl / Cmd + S', action: 'Save' },
  { keys: 'Ctrl / Cmd + Shift + S', action: 'Save as' },
  { keys: 'Ctrl / Cmd + W', action: 'Close tab' },
  { keys: 'Ctrl / Cmd + F', action: 'Find' },
  { keys: 'Ctrl / Cmd + H', action: 'Find and replace' },
  { keys: 'F12 or Ctrl / Cmd + Shift + I', action: 'Toggle developer tools' }
]

export type ReferenceEntry = readonly [name: string, description: string, values: string]

export const settingsReference: ReferenceEntry[] = [
  ['Appearance', 'Follow the system appearance, or force light or dark.', 'System · Light · Dark'],
  [
    'Editor theme',
    'Colour theme for the formatted editor.',
    'Rustic · Scholarly · Monotone · custom'
  ],
  ['Word wrap', 'Wrap long lines in the source view.', 'Off · On'],
  [
    'Spellcheck',
    'Underline misspelled words and keep a personal dictionary.',
    'English (UK) · English (US)'
  ],
  [
    'Markdown syntax',
    'Enable hard breaks, strikethrough, tables, task lists, math, and autolinks.',
    'On or off per element'
  ],
  ['Open behaviour', 'Open a file in the current tab or a new tab.', 'Same tab · New tab'],
  ['Formatting bar', 'Show or hide the editor formatting bar.', 'Visible · Hidden']
]
