// Spec 038: electron-builder afterPack hook (resolved from the `afterPack`
// config key). Copies the built shell-extension DLL into win-unpacked so the
// appx target packs it at `app\resources\shell-extension\`.
//
// Deliberately a silent no-op whenever the DLL has not been built: ordinary
// NSIS/zip release builds never gain the component, keeping their artifacts
// byte-identical (SC-003). Only the Store build (.github/workflows/build-store.yml)
// and explicit local verification build the DLL first.
'use strict'

const fs = require('fs')
const path = require('path')

const DLL_NAME = 'MarkdownMeisterShellExtension.dll'
const SOURCE_DLL = path.join(__dirname, '..', 'native', 'shell-extension', 'out', 'x64', 'Release', DLL_NAME)
const DEST_DIR_NAME = 'shell-extension'

/** electron-builder lifecycle hook signature. Returns Promise<void>. */
module.exports = async function copyShellExtension(context) {
  if (process.platform !== 'win32') return
  if (!fs.existsSync(SOURCE_DLL)) return

  const destinationDir = path.join(context.appOutDir, 'resources', DEST_DIR_NAME)
  fs.mkdirSync(destinationDir, { recursive: true })
  fs.copyFileSync(SOURCE_DLL, path.join(destinationDir, DLL_NAME))
}
