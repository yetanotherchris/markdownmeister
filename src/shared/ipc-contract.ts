export type ErrorCode =
  | 'OUTSIDE_WORKSPACE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PERMISSION'
  | 'LOCKED'
  | 'TOO_LARGE'
  | 'NOT_TEXT'
  | 'TRASH_UNAVAILABLE'
  | 'NO_WORKSPACE'
  | 'IO'

export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string }

export type EntryKind = 'file' | 'directory'

export interface WorkspaceInfo {
  name: string

  path: string | null
  entries: DirEntry[]
}

export interface DirEntry {
  path: string
  name: string
  kind: EntryKind
}

/** One file's content-search result: the occurrence count and the distinct
 *  matching lines (full text, in file order). */
export interface SearchContentResult {
  path: string
  count: number
  lines: string[]
}

export interface OpenedFile {
  path: string | null
  name: string
  content: string
  mtimeMs: number
  size: number

  canonicalPath?: string
}

export interface WriteReceipt {
  mtimeMs: number
  size: number
}

export interface TrashReceipt {
  trashed: boolean
}

export interface EntryInfo {
  kind: EntryKind
  /** Directory only: true when the folder contains no entries at all. */
  isEmpty: boolean

  hasHiddenFiles: boolean
}

export interface WatchEvent {
  path: string
  kind: 'added' | 'changed' | 'removed'
  isDirectory: boolean
}

export interface DocumentChangeEvent {
  path: string
  kind: 'changed' | 'removed'
}

export type RecentKind = 'file' | 'folder'

export interface RecentItem {
  path: string
  kind: RecentKind
  name: string
  lastOpenedAt: number
}

export interface RecentItemsWarning {
  message: string
}

export type NativeDialogRequest =
  | { kind: 'unsaved-close'; documentTitle: string; error?: string }
  | { kind: 'unsaved-quit'; documentTitles: string[]; error?: string }
  | { kind: 'folder-open'; documentTitles: string[]; error?: string }
  | { kind: 'external-changed'; documentTitle: string }
  | { kind: 'external-removed'; documentTitle: string; error?: string }
  | { kind: 'delete-to-trash'; targetName: string; detail: string; cleanToCloseTitles: string[] }
  | { kind: 'permanent-delete'; targetName: string; detail: string; cleanToCloseTitles: string[] }
  | { kind: 'delete-blocked'; targetName: string; blockerTitles: string[] }
  | { kind: 'operation-failed'; message: string }

export type NativeDialogDecision =
  | 'save'
  | 'discard'
  | 'save-all'
  | 'discard-all'
  | 'keep'
  | 'reload'
  | 'ok'
  | 'save-as'
  | 'delete'
  | 'delete-permanent'
  | 'acknowledge'
  | 'cancel'

export type MenuCommand =
  | 'open-file'
  | 'open-folder'
  | 'save'
  | 'save-as'
  | 'close-tab'
  | 'new-file'
  | 'find'
  | { type: 'open-recent'; path: string; kind: RecentKind }

export type OsOpenRequest =
  | { kind: 'file'; file: OpenedFile }
  | { kind: 'folder'; info: WorkspaceInfo }
  | { kind: 'failed'; message: string }

export type SpellcheckLanguage = 'en-GB' | 'en-US'

export interface EditorColors {
  background: string
  foreground: string
  accent: string
  surface: string
  outline: string
  code: string
}

export interface EditorThemeDefinition {
  name: string
  typeface: string
  light: EditorColors
  dark: EditorColors
}

export interface EditorThemesList {
  themes: EditorThemeDefinition[]
  invalidNames: string[]
}

export type FileOpenBehavior = 'same-tab' | 'new-tab'

export interface Settings {
  sidebarWidth: number
  themeOverride: 'light' | 'dark' | null

  explorerVisible: boolean

  editorTheme: string

  spellcheckEnabled: boolean

  spellcheckLanguage: SpellcheckLanguage | null

  fileOpenBehavior: FileOpenBehavior

  hardBreaks: boolean

  strikethrough: boolean

  tables: boolean

  taskLists: boolean

  math: boolean

  autolink: boolean

  visualCodeHighlighting: boolean

  formattingBarVisible: boolean

  wordWrap: boolean
}

export interface BuildInfo {
  version: string
  revision: string | null
  repositoryUrl: string
}

export interface DesktopApi {
  platform: NodeJS.Platform

  prepareFolderOpen(path?: string): Promise<Result<WorkspaceInfo | null>>
  /** Phase 2 of folder open: commit the prepared folder as the active
   *  workspace and record it in Recent Items. */
  commitFolderOpen(): Promise<Result<WorkspaceInfo>>
  /** Abandon a prepared folder open (no workspace change). */
  cancelFolderOpen(): Promise<Result<null>>
  readDir(relativePath: string): Promise<Result<DirEntry[]>>
  /** Content search: per-file occurrence counts and matching lines for the
   *  markdown files whose contents contain the term, scanned from the
   *  workspace root in the main process. */
  searchContents(term: string): Promise<Result<SearchContentResult[]>>
  openFileDialog(): Promise<Result<OpenedFile | null>>
  readFile(relativePath: string): Promise<Result<OpenedFile>>
  openRecentFile(path: string): Promise<Result<OpenedFile>>
  writeFile(relativePath: string, content: string): Promise<Result<WriteReceipt>>
  saveFileDialog(suggestedName: string, content: string): Promise<Result<OpenedFile | null>>
  createEntry(parentRelativePath: string, name: string, kind: EntryKind): Promise<Result<DirEntry>>
  moveEntry(fromRelativePath: string, toRelativePath: string): Promise<Result<DirEntry>>
  trashEntry(relativePath: string, permanent?: boolean): Promise<Result<TrashReceipt>>
  describeEntry(relativePath: string): Promise<Result<EntryInfo>>

  revealEntry(relativePath: string, kind: EntryKind): Promise<Result<null>>
  getSettings(): Promise<Result<Settings>>
  updateSettings(patch: Partial<Settings>): Promise<Result<Settings>>

  getEditorThemes(): Promise<Result<EditorThemesList>>
  onWorkspaceChanged(cb: (e: WatchEvent) => void): () => void
  onDocumentChanged(cb: (e: DocumentChangeEvent) => void): () => void
  onMenuCommand(cb: (c: MenuCommand) => void): () => void
  onRecentItemsWarning(cb: (w: RecentItemsWarning) => void): () => void
  onRecentItemsOk(cb: () => void): () => void

  onOsFileOpen(cb: (file: OpenedFile) => void): () => void

  onOsFolderOpen(cb: (info: WorkspaceInfo) => void): () => void

  onOsOpenFailed(cb: (message: string) => void): () => void

  notifyOsReady(): void
  onQuitRequested(cb: () => void): () => void
  confirmQuit(decision: 'quit' | 'cancel'): void

  showConfirmation(request: NativeDialogRequest): Promise<Result<NativeDialogDecision>>

  getRecentItems(): Promise<Result<RecentItem[]>>

  clearRecentItems(): Promise<Result<null>>

  requestQuit(): Promise<Result<null>>

  getSpellcheckWords(): Promise<Result<string[]>>

  addSpellcheckWord(word: string): Promise<Result<string[]>>

  getBuildInfo(): Promise<Result<BuildInfo>>

  openRepositoryUrl(): Promise<Result<null>>
}
