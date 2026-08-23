// Spec 038: electron-builder afterPack hook (resolved from the `afterPack`
// config key). Copies the built shell-extension DLL into win-unpacked so the
// appx target packs it at `app\resources\shell-extension\`.
//
// Non-Store targets stay a silent no-op whenever the DLL has not been built:
// ordinary NSIS/zip release builds never gain the component, keeping their
// artifacts byte-identical (SC-003). The appx target is the exception — there
// a missing DLL throws, because packing without it would ship a manifest
// referencing an absent file. Only the Store build
// (.github/workflows/build-store.yml) and explicit local verification build
// the DLL first.
'use strict'

const fs = require('fs')
const path = require('path')

const DLL_NAME = 'MarkdownMeisterShellExtension.dll'
// COUPLED to scripts/build-shell-extension.ps1's defaults (-Arch x64
// -Configuration Release → out\x64\Release): changing either side's default
// requires changing both, or Store packages silently lose the extension.
const SOURCE_DLL = path.join(__dirname, '..', 'native', 'shell-extension', 'out', 'x64', 'Release', DLL_NAME)
const DEST_DIR_NAME = 'shell-extension'

/** electron-builder lifecycle hook signature. Returns Promise<void>. */
module.exports = async function copyShellExtension(context) {
  if (process.platform !== 'win32') return

  const wantsAppx = Array.isArray(context.targets) && context.targets.some((target) => target?.name === 'appx')
  if (!fs.existsSync(SOURCE_DLL)) {
    // A missing DLL must never ship in a Store package: its manifest declares
    // com:Class Path at this exact location, so packing without it produces a
    // submission candidate only caught at Partner Center. Non-Store targets
    // stay a silent no-op so ordinary release builds remain byte-identical.
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
