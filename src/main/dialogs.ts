import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { buildNativeDialogOptions, decisionFromResponse } from '../shared/nativeDialog'
import type { NativeDialogDecision, NativeDialogRequest, ErrorCode } from '../shared/ipc-contract'

let confirmationInFlight = false


export async function showNativeConfirmation(window: BrowserWindow, request: NativeDialogRequest): Promise<NativeDialogDecision> {
  if (confirmationInFlight) {
    throw Object.assign(new Error('A native confirmation dialog is already open'), { code: 'IO' as ErrorCode })
  }
  confirmationInFlight = true
  try {
    const options = buildNativeDialogOptions(process.platform, request)
    const { response } = await dialog.showMessageBox(window, options)
    return decisionFromResponse(process.platform, request, response)
  } finally {
    confirmationInFlight = false
  }
}
