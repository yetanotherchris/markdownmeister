import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { runInNewContext } from 'node:vm'

const source = readFileSync(path.resolve(__dirname, '../../scripts/notarize-macos.cjs'), 'utf8')
const context = {
  electronPlatformName: 'darwin',
  appOutDir: '/tmp/app',
  packager: { appInfo: { productFilename: 'markdownmeister' } }
}
const command = vi.fn()
const notarize = vi.fn()
let environment: Record<string, string>

function isHook(value: unknown): value is (buildContext: typeof context) => Promise<void> {
  return typeof value === 'function'
}

function hook(): (buildContext: typeof context) => Promise<void> {
  const module: { exports: unknown } = { exports: undefined }
  runInNewContext(source, {
    module,
    process: { env: environment },
    console: { log: vi.fn() },
    require: (name: string) => {
      if (name === 'node:path') return path
      if (name === 'node:child_process') return { spawnSync: command }
      if (name === '@electron/notarize') return { notarize }
      throw new Error(`Unexpected module: ${name}`)
    }
  })
  if (!isHook(module.exports)) throw new Error('Notarization hook was not exported')
  return module.exports
}

beforeEach(() => {
  environment = {}
  command.mockReset()
  notarize.mockReset()
  command.mockReturnValue({ status: 0, stderr: 'Signature=adhoc', stdout: '' })
})

describe('macOS notarization hook', () => {
  it.each([
    { status: 0, stderr: 'Signature=adhoc' },
    { status: 1, stderr: 'code object is not signed at all' }
  ])('allows unsigned local packaging without Apple credentials: $stderr', async (result) => {
    command.mockReturnValue(result)
    await hook()(context)
    expect(notarize).not.toHaveBeenCalled()
  })

  it('rejects unsigned CI builds', async () => {
    environment.CI = 'true'
    await expect(hook()(context)).rejects.toThrow('require a Developer ID Application signature')
    expect(notarize).not.toHaveBeenCalled()
  })

  it('surfaces inspection errors instead of skipping notarization', async () => {
    command.mockReturnValue({ status: 1, stderr: 'bundle format unrecognized' })
    await expect(hook()(context)).rejects.toThrow('Cannot inspect app signature')
  })

  it('requires credentials for a Developer ID app', async () => {
    command.mockReturnValue({ status: 0, stderr: 'Authority=Developer ID Application: Example' })
    await expect(hook()(context)).rejects.toThrow(
      'Missing required notarization environment variable'
    )
  })

  it('rejects an invalid Developer ID signature', async () => {
    command.mockReturnValueOnce({
      status: 0,
      stderr: 'Authority=Developer ID Application: Example'
    })
    command.mockReturnValueOnce({ status: 1, stderr: 'invalid signature' })
    await expect(hook()(context)).rejects.toThrow('App signature verification failed')
    expect(notarize).not.toHaveBeenCalled()
  })

  it('notarizes the signed app and propagates Apple rejection', async () => {
    environment = { APPLE_API_KEY: 'key.p8', APPLE_API_KEY_ID: 'id', APPLE_API_ISSUER: 'issuer' }
    command.mockReturnValue({ status: 0, stderr: 'Authority=Developer ID Application: Example' })
    notarize.mockRejectedValue(new Error('Apple rejected build'))
    await expect(hook()(context)).rejects.toThrow('Apple rejected build')
    expect(notarize).toHaveBeenCalledWith({
      appPath: path.join(context.appOutDir, 'markdownmeister.app'),
      appleApiKey: 'key.p8',
      appleApiKeyId: 'id',
      appleApiIssuer: 'issuer'
    })
  })
})
