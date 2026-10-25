import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('Mac App Store delivery', () => {
  it('passes the credential, signature, and upload regression tests', () => {
    const result = spawnSync(
      process.platform === 'win32' ? 'python' : 'python3',
      [
        '-B',
        '-m',
        'unittest',
        'discover',
        '-s',
        'tests/packaging',
        '-p',
        'test_macos_store.py',
        '-v'
      ],
      { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }
    )

    expect(result.error, result.error?.message).toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  it('loads a valid Store-only builder configuration with its inherited hooks resolved', () => {
    const script = `
      const assert = require('node:assert/strict')
      const { getConfig, validateConfiguration } = require('app-builder-lib/out/util/config/config')
      ;(async () => {
        const config = await getConfig(process.cwd(), 'packaging/macos/store.mjs', {
          extraMetadata: { version: '9.9.99' }
        })
        await validateConfiguration(config)
        assert.equal(config.appId, 'dev.yetanotherchris.markdownmeister')
        assert.equal(config.extraMetadata.version, '9.9.99')
        assert.equal(config.mac.target, 'mas')
        assert.equal(config.afterSign, null)
        assert.equal(config.forceCodeSigning, true)
        assert.equal(config.directories.output, 'dist-store')
        assert.equal(config.mas.bundleVersion, '12')
        assert.equal(config.mas.provisioningProfile, '/private/store.provisionprofile')
        assert.equal(config.mas.entitlements, 'packaging/macos/entitlements.mas.plist')
        assert.equal(config.mas.entitlementsInherit, 'packaging/macos/entitlements.mas.inherit.plist')
      })().catch(error => { console.error(error); process.exitCode = 1 })
    `
    const result = spawnSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MACOS_STORE_BUILD_NUMBER: '12',
        MACOS_STORE_PROFILE_PATH: '/private/store.provisionprofile'
      }
    })

    expect(result.error, result.error?.message).toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })
})
