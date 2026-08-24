// Spec 038: electron-builder afterPack hook (resolved from the `afterPack`
// config key). Copies the built shell-extension DLL into win-unpacked so the
// appx target packs it at `app\resources\shell-extension\`.
//
// Non-Store targets skip this hook when the DLL is absent. Appx packages need
// the DLL because their manifest references it, so the hook reports an error.
'use strict'

const fs = require('fs')
const path = require('path')

const DLL_NAME = 'MarkdownMeisterShellExtension.dll'
// Keep this path aligned with the defaults in build-shell-extension.ps1.
const SOURCE_DLL = path.join(__dirname, '..', 'native', 'shell-extension', 'out', 'x64', 'Release', DLL_NAME)
const DEST_DIR_NAME = 'shell-extension'

/** electron-builder lifecycle hook signature. Returns Promise<void>. */
module.exports = async function copyShellExtension(context) {
  if (process.platform !== 'win32') return

  const wantsAppx = Array.isArray(context.targets) && context.targets.some((target) => target?.name === 'appx')
  if (!fs.existsSync(SOURCE_DLL)) {
    // The Appx manifest declares the DLL at this path.
    if (wantsAppx) {
      throw new Error(
        `appx target needs the shell extension DLL but it was not built (${SOURCE_DLL}). Run scripts/build-shell-extension.ps1 first.`
      )
    }
    return
  }

  const destinationDir = path.join(context.appOutDir, 'resources', DEST_DIR_NAME)
  fs.mkdirSync(destinationDir, { recursive: true })
  fs.copyFileSync(SOURCE_DLL, path.join(destinationDir, DLL_NAME))
}
