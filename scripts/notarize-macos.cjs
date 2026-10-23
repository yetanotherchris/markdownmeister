const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { notarize } = require('@electron/notarize')

const requiredEnvironment = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']

function missingEnvironment(environment) {
  return requiredEnvironment.filter((name) => !environment[name])
}

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const signature = spawnSync('codesign', ['--display', '--verbose=4', appPath], {
    encoding: 'utf8'
  })
  if (signature.error) throw signature.error
  const details = `${signature.stdout || ''}\n${signature.stderr || ''}`
  const unsigned = signature.status === 1 && details.includes('code object is not signed at all')
  if (signature.status !== 0 && !unsigned)
    throw new Error(`Cannot inspect app signature: ${details}`)
  if (unsigned || !details.includes('Authority=Developer ID Application:')) {
    if (process.env.CI)
      throw new Error('CI macOS builds require a Developer ID Application signature')
    console.log('Skipping notarization for a local app without a Developer ID signature')
    return
  }

  const verification = spawnSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    encoding: 'utf8'
  })
  if (verification.error) throw verification.error
  if (verification.status !== 0) {
    throw new Error(
      `App signature verification failed: ${verification.stderr || verification.stdout}`
    )
  }

  for (const name of missingEnvironment(process.env)) {
    throw new Error(`Missing required notarization environment variable: ${name}`)
  }

  await notarize({
    appPath,
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER
  })
}

module.exports.missingEnvironment = missingEnvironment
