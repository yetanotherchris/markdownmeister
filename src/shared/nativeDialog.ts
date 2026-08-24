import type { NativeDialogDecision, NativeDialogRequest } from './ipc-contract'

/** Dialog layouts for the platforms supported by Electron. The `buttons` array
 * is rendered differently on each platform:
 *
 * - Windows (`TaskDialogIndirect`): array order is the visual left→right order;
 *   Enter = `defaultId`, Escape/window-close = `cancelId`.
 * - macOS (`NSAlert`): `buttons[0]` renders in the default position at right;
 *   later buttons extend left, so the array order is the visual
 *   order reversed; Escape = `cancelId`.
 * - Linux (`GtkMessageDialog`): array order is the visual left→right order;
 *   the default response is `defaultId`; Escape/close = `cancelId`.
 *
 * This module has no Electron dependency, so its layouts can be unit tested.
 */

export type DialogPlatform = 'win32' | 'darwin' | 'linux'

export interface NativeDialogLayout {
  type: 'none' | 'info' | 'question' | 'warning' | 'error'
  title: string
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number

  noLink?: boolean
}

interface ButtonLayout {
  buttons: string[]
  defaultId: number
  cancelId: number
}

function platformOf(p: string): DialogPlatform {
  if (p === 'win32' || p === 'darwin') return p
  return 'linux'
}

const CANCEL = 'Cancel'
const OK = 'OK'

/** Save / Discard / Cancel, the shape shared by unsaved-close, unsaved-quit
 *  and folder-open. `save` is the default (Return) on every platform; Cancel is
 *  the Escape choice. */
function saveDiscardCancel(saveLabel: string, discardLabel: string): Record<DialogPlatform, ButtonLayout> {
  return {
    win32: { buttons: [saveLabel, discardLabel, CANCEL], defaultId: 0, cancelId: 2 },
    darwin: { buttons: [saveLabel, CANCEL, discardLabel], defaultId: 0, cancelId: 1 },
    linux: { buttons: [CANCEL, discardLabel, saveLabel], defaultId: 2, cancelId: 0 }
  }
}


const keepReplace: Record<DialogPlatform, ButtonLayout> = {
  win32: { buttons: ['Keep My Version', 'Reload from Disk'], defaultId: 0, cancelId: 0 },
  darwin: { buttons: ['Keep My Version', 'Reload from Disk'], defaultId: 0, cancelId: 0 },
  linux: { buttons: ['Reload from Disk', 'Keep My Version'], defaultId: 1, cancelId: 1 }
}

/** OK / Save As..., default is the expected non-destructive action (Save As). */
const okSaveAs: Record<DialogPlatform, ButtonLayout> = {
  win32: { buttons: ['Save As...', OK], defaultId: 0, cancelId: 1 },
  darwin: { buttons: ['Save As...', OK], defaultId: 0, cancelId: 1 },
  linux: { buttons: [OK, 'Save As...'], defaultId: 1, cancelId: 0 }
}


const deleteCancel: Record<DialogPlatform, ButtonLayout> = {
  win32: { buttons: ['Delete', CANCEL], defaultId: 0, cancelId: 1 },
  darwin: { buttons: ['Delete', CANCEL], defaultId: 0, cancelId: 1 },
  linux: { buttons: [CANCEL, 'Delete'], defaultId: 1, cancelId: 0 }
}


const permanentDeleteCancel: Record<DialogPlatform, ButtonLayout> = {
  win32: { buttons: ['Delete Permanently', CANCEL], defaultId: 1, cancelId: 1 },
  darwin: { buttons: [CANCEL, 'Delete Permanently'], defaultId: 0, cancelId: 0 },
  linux: { buttons: ['Delete Permanently', CANCEL], defaultId: 1, cancelId: 1 }
}

/** Single acknowledgement button. */
const acknowledge: ButtonLayout = { buttons: [OK], defaultId: 0, cancelId: 0 }

function layoutFor(platform: DialogPlatform, request: NativeDialogRequest): ButtonLayout {
  switch (request.kind) {
    case 'unsaved-close':
      return saveDiscardCancel('Save', "Don't Save")[platform]
    case 'unsaved-quit':
      return saveDiscardCancel('Save All', 'Discard and Quit')[platform]
    case 'folder-open':
      return saveDiscardCancel('Save All', 'Discard')[platform]
    case 'external-changed':
      return keepReplace[platform]
    case 'external-removed':
      return okSaveAs[platform]
    case 'delete-to-trash':
      return deleteCancel[platform]
    case 'permanent-delete':
      return permanentDeleteCancel[platform]
    case 'delete-blocked':
    case 'operation-failed':
      return acknowledge
  }
}


type MessageResult = { type: NativeDialogLayout['type']; message: string; detail: string }

function joinList(header: string, titles: string[], error: string | undefined): string[] {
  const lines: string[] = []
  if (titles.length > 0) lines.push(header, ...titles.map(t => `• ${t}`))
  if (error) lines.push(error)
  return lines
}

const messagesForKind: Record<NativeDialogRequest['kind'], (req: NativeDialogRequest) => MessageResult> = {
  'unsaved-close': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'unsaved-close' }>
    const lines = ["Your changes will be lost if you don't save them."]
    if (request.error) lines.push(request.error)
    return {
      type: 'warning',
      message: `Do you want to save the changes you made to ${request.documentTitle}?`,
      detail: lines.join('\n')
    }
  },
  'unsaved-quit': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'unsaved-quit' }>
    const lines = joinList('The following documents have unsaved changes:', request.documentTitles, undefined)
    lines.push("Your changes will be lost if you don't save them.")
    if (request.error) lines.push(request.error)
    return {
      type: 'warning',
      message: 'Do you want to save the changes you made?',
      detail: lines.join('\n')
    }
  },
  'folder-open': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'folder-open' }>
    const lines = joinList('The following documents have unsaved changes:', request.documentTitles, undefined)
    lines.push("Your changes will be lost if you don't save them.")
    if (request.error) lines.push(request.error)
    return {
      type: 'warning',
      message: 'Open folder with unsaved changes?',
      detail: lines.join('\n')
    }
  },
  'external-changed': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'external-changed' }>
    return {
      type: 'warning',
      message: `${request.documentTitle} was modified by another program. Keep your version, or replace it with the version on disk?`,
      detail: ''
    }
  },
  'external-removed': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'external-removed' }>
    return {
      type: 'warning',
      message: `${request.documentTitle} was deleted or renamed on disk. Its content is still open here; you can save it to a new location.`,
      detail: request.error ?? ''
    }
  },
  'delete-to-trash': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'delete-to-trash' }>
    const lines = [request.detail]
    if (request.cleanToCloseTitles.length > 0) {
      lines.push(...request.cleanToCloseTitles.map(t => `This will close ${t}.`))
    }
    lines.push('It will be moved to the recycle bin or trash.')
    return {
      type: 'warning',
      message: `Delete ${request.targetName}?`,
      detail: lines.filter(Boolean).join('\n')
    }
  },
  'permanent-delete': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'permanent-delete' }>
    const lines = [
      `${request.targetName} could not be moved to the recycle bin or trash on this system. Deleting it permanently cannot be undone.`
    ]
    if (request.cleanToCloseTitles.length > 0) {
      lines.push(...request.cleanToCloseTitles.map(t => `This will close ${t}.`))
    }
    lines.push('Delete permanently anyway?')
    return {
      type: 'warning',
      message: 'Trash unavailable',
      detail: lines.filter(Boolean).join('\n')
    }
  },
  'delete-blocked': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'delete-blocked' }>
    const lines = joinList('Blocked by:', request.blockerTitles, undefined)
    return {
      type: 'warning',
      message: 'Cannot delete',
      detail: [
        `${request.targetName} has unsaved changes in the editor. Save or close ${request.blockerTitles.length === 1 ? 'the document' : 'those documents'} before deleting it.`,
        ...lines
      ].join('\n')
    }
  },
  'operation-failed': (req) => {
    const request = req as Extract<NativeDialogRequest, { kind: 'operation-failed' }>
    return {
      type: 'error',
      message: 'Operation failed',
      detail: request.message
    }
  }
}

function messagesFor(request: NativeDialogRequest): MessageResult {
  return messagesForKind[request.kind](request)
}

/** Builds `showMessageBox` options for a request. An empty title lets the
 * operating system display the application name. */
export function buildNativeDialogOptions(platform: string, request: NativeDialogRequest): NativeDialogLayout {
  const p = platformOf(platform)
  const layout = layoutFor(p, request)
  const { type, message, detail } = messagesFor(request)
  return {
    type,
    title: '',
    message,
    detail,
    buttons: [...layout.buttons],
    defaultId: layout.defaultId,
    cancelId: layout.cancelId,
    ...(p === 'win32' ? { noLink: true } : {})
  }
}


export function decisionFromResponse(platform: string, request: NativeDialogRequest, response: number): NativeDialogDecision {
  const p = platformOf(platform)
  const { buttons, cancelId } = layoutFor(p, request)
  if (response === cancelId) {
    return cancelDecision(request)
  }
  const clicked = buttons[response]
  if (typeof clicked !== 'string') {
    // Out-of-range / garbage index: fail closed to the safe outcome.
    return cancelDecision(request)
  }
  switch (request.kind) {
    case 'unsaved-close':
      return clicked === 'Save' ? 'save' : 'discard'
    case 'unsaved-quit':
    case 'folder-open':
      return clicked === 'Save All' ? 'save-all' : 'discard-all'
    case 'external-changed':
      return clicked === 'Keep My Version' ? 'keep' : 'reload'
    case 'external-removed':
      return clicked === 'Save As...' ? 'save-as' : 'ok'
    case 'delete-to-trash':
      return clicked === 'Delete' ? 'delete' : 'cancel'
    case 'permanent-delete':
      return clicked === 'Delete Permanently' ? 'delete-permanent' : 'cancel'
    case 'delete-blocked':
    case 'operation-failed':
      return 'acknowledge'
  }
  // Not reachable for valid responses, but the click index is untrusted renderer
  // input mapped in main: fail closed to the safe outcome.
  return cancelDecision(request)
}


function cancelDecision(request: NativeDialogRequest): NativeDialogDecision {
  switch (request.kind) {
    case 'unsaved-close':
      return 'cancel'
    case 'unsaved-quit':
    case 'folder-open':
      return 'cancel'
    case 'external-changed':
      return 'keep'
    case 'external-removed':
      return 'ok'
    case 'delete-to-trash':
    case 'permanent-delete':
      return 'cancel'
    case 'delete-blocked':
    case 'operation-failed':
      return 'acknowledge'
  }
}
