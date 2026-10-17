const path = require('node:path')
const { notarize } = require('@electron/notarize')

const requiredEnvironment = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']

function missingEnvironment(environment) {
  return requiredEnvironment.filter((name) => !environment[name])
}

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return

  for (const name of missingEnvironment(process.env)) {
    throw new Error(`Missing required notarization environment variable: ${name}`)
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  await notarize({
    appPath,
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER
  })
}

module.exports.missingEnvironment = missingEnvironment
