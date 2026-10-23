import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packageArtifacts } from '../../scripts/package-macos-artifacts.mjs'

const command = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ spawnSync: command }))
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  symlinkSync: vi.fn()
}))

let output: string

beforeEach(() => {
  output = mkdtempSync(join(tmpdir(), 'mm-package-test-'))
  command.mockReset()
  command.mockReturnValue({ status: 0, stdout: '', stderr: '' })
  vi.mocked(symlinkSync).mockClear()
})

afterEach(() => {
  rmSync(output, { force: true, recursive: true })
})

function createApp(arch: string): string {
  const appPath = join(output, arch === 'arm64' ? 'mac-arm64' : 'mac', 'markdownmeister.app')
  mkdirSync(appPath, { recursive: true })
  return appPath
}

describe('macOS release archives', () => {
  it.each<{ arch: 'arm64' | 'x64'; cpu: string }>([
    { arch: 'arm64', cpu: 'arm64' },
    { arch: 'x64', cpu: 'x86_64' }
  ])('packages only the selected $arch architecture', ({ arch, cpu }) => {
    const appPath = createApp(arch)
    packageArtifacts({ artifactsDir: output, version: '1.8.4', arch })

    expect(command).toHaveBeenCalledWith(
      '/usr/bin/lipo',
      ['-verify_arch', cpu, join(appPath, 'Contents', 'MacOS', 'markdownmeister')],
      expect.any(Object)
    )
    expect(command).toHaveBeenCalledWith(
      '/usr/bin/hdiutil',
      ['verify', join(output, `markdownmeister-1.8.4-macos-${arch}.dmg`)],
      expect.any(Object)
    )
    expect(command).toHaveBeenLastCalledWith(
      '/usr/bin/ditto',
      [
        '-c',
        '-k',
        '--sequesterRsrc',
        '--keepParent',
        appPath,
        join(output, `markdownmeister-1.8.4-macos-${arch}.zip`)
      ],
      expect.any(Object)
    )
    const stagingLink = vi.mocked(symlinkSync).mock.calls[0][1]
    const staging = join(stagingLink.toString(), '..')
    expect(command).toHaveBeenCalledWith(
      '/usr/bin/ditto',
      [appPath, join(staging, 'markdownmeister.app')],
      expect.any(Object)
    )
    expect(command).toHaveBeenCalledWith(
      '/usr/bin/hdiutil',
      [
        'create',
        '-srcfolder',
        staging,
        '-volname',
        'MarkdownMeister 1.8.4',
        '-fs',
        'HFS+',
        '-format',
        'UDZO',
        join(output, `markdownmeister-1.8.4-macos-${arch}.dmg`)
      ],
      expect.any(Object)
    )
    expect(symlinkSync).toHaveBeenCalledWith('/Applications', stagingLink)
    expect(existsSync(stagingLink)).toBe(false)
  })

  it('removes partial archives and stops when image checksums are invalid', () => {
    createApp('arm64')
    const dmgPath = join(output, 'markdownmeister-1.8.4-macos-arm64.dmg')
    command.mockImplementation((tool: string, args: string[]) => {
      if (tool === '/usr/bin/hdiutil' && args[0] === 'create') writeFileSync(dmgPath, 'partial')
      return args[0] === 'verify'
        ? { status: 1, stderr: 'image data corrupted' }
        : { status: 0, stdout: '', stderr: '' }
    })

    expect(() =>
      packageArtifacts({ artifactsDir: output, version: '1.8.4', arch: 'arm64' })
    ).toThrow('image data corrupted')
    expect(existsSync(dmgPath)).toBe(false)
    expect(command.mock.calls.some((call) => call[1].includes('--keepParent'))).toBe(false)
    const stagingLink = vi.mocked(symlinkSync).mock.calls[0][1]
    expect(existsSync(join(stagingLink.toString(), '..'))).toBe(false)
  })

  it('refuses to overwrite existing release assets', () => {
    createApp('arm64')
    writeFileSync(join(output, 'markdownmeister-1.8.4-macos-arm64.zip'), 'existing')
    expect(() =>
      packageArtifacts({ artifactsDir: output, version: '1.8.4', arch: 'arm64' })
    ).toThrow('Release archives already exist')
    expect(command).not.toHaveBeenCalled()
  })

  it('stops on an architecture mismatch before creating archives', () => {
    createApp('arm64')
    command.mockReturnValue({ status: 1, stderr: 'does not contain the specified architecture' })
    expect(() =>
      packageArtifacts({ artifactsDir: output, version: '1.8.4', arch: 'arm64' })
    ).toThrow('does not contain the specified architecture')
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing app before invoking archive tools', () => {
    expect(() =>
      packageArtifacts({ artifactsDir: output, version: '1.8.4', arch: 'arm64' })
    ).toThrow('Missing packaged application')
    expect(command).not.toHaveBeenCalled()
  })
})
