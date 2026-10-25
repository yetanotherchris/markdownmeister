import process from 'node:process'

export default {
  extends: './electron-builder.yml',
  appId: 'dev.yetanotherchris.markdownmeister',
  directories: { output: 'dist-store' },
  forceCodeSigning: true,
  afterSign: null,
  mac: {
    target: 'mas',
    category: 'public.app-category.productivity'
  },
  mas: {
    type: 'distribution',
    artifactName: 'markdownmeister-${version}-macos-store-${arch}.${ext}',
    hardenedRuntime: false,
    entitlements: 'packaging/macos/entitlements.mas.plist',
    entitlementsInherit: 'packaging/macos/entitlements.mas.inherit.plist',
    provisioningProfile: process.env.MACOS_STORE_PROFILE_PATH,
    bundleVersion: process.env.MACOS_STORE_BUILD_NUMBER
  }
}
