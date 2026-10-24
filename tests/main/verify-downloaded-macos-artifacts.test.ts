import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyArtifacts } from '../../scripts/verify-macos-artifacts.mjs'

const command = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ spawnSync: command }))
const identity = 'Developer ID Application: Example (TEAMID)'
let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mm-downloaded-'))
  for (const extension of ['dmg', 'zip']) {
    writeFileSync(
      join(directory, `markdownmeister-1.8.4-macos-arm64.${extension}`),
      'downloaded bytes'
    )
  }
  command.mockReset()
  command.mockImplementation((tool: string, args: string[]) => {
    if (tool === 'hdiutil' && args[0] === 'attach') {
      mkdirSync(join(args[args.length - 1], 'markdownmeister.app'))
    }
    if (tool === 'ditto') mkdirSync(join(args[args.length - 1], 'markdownmeister.app'))
    return { status: 0, stdout: '', stderr: `Authority=${identity}\nRuntime Version=15.0` }
  })
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

function verify(): void {
  verifyArtifacts({ artifactsDir: directory, version: '1.8.4', arch: 'arm64', identity })
}

describe('downloaded macOS artifacts', () => {
  it.each([identity, ` ${identity} \n`, 'Example (TEAMID)', ' Example (TEAMID) \n'])(
    'accepts the configured full or short Developer ID name %j',
    (configuredIdentity) => {
      verifyArtifacts({
        artifactsDir: directory,
        version: '1.8.4',
        arch: 'arm64',
        identity: configuredIdentity
      })
      expect(command.mock.calls.filter(([name]) => name === 'spctl')).toHaveLength(2)
    }
  )

  it.each(['Example', 'Example (OTHERTEAM)', 'Apple Distribution: Example (TEAMID)', ' \n'])(
    'rejects a partial, different, or empty signing identity %j',
    (configuredIdentity) => {
      expect(() =>
        verifyArtifacts({
          artifactsDir: directory,
          version: '1.8.4',
          arch: 'arm64',
          identity: configuredIdentity
        })
      ).toThrow('Expected Developer ID identity')
      expect(command.mock.calls.some(([name]) => name === 'ditto')).toBe(false)
    }
  )

  it.each(['ditto', 'codesign', 'xcrun', 'spctl'])(
    'rejects ZIP-specific %s failure and cleans up extraction after the DMG passes',
    (tool) => {
      const success = command.getMockImplementation()
      if (!success) throw new Error('Missing successful command stub')
      let extraction = ''
      command.mockImplementation((name: string, args: string[]) => {
        if (name === 'ditto') extraction = args[args.length - 1]
        const result = success(name, args)
        const zipCommand =
          extraction && (name === 'ditto' || args.some((arg) => arg.includes(extraction)))
        return zipCommand && name === tool ? { status: 1, stderr: 'ZIP rejected' } : result
      })
      expect(verify).toThrow('ZIP rejected')
      expect(extraction).not.toBe('')
      expect(existsSync(extraction)).toBe(false)
      expect(
        command.mock.calls.some(([name, args]) => name === 'hdiutil' && args[0] === 'detach')
      ).toBe(true)
    }
  )

  it('checks image integrity before mounting and validates both contained apps', () => {
    verify()
    expect(command.mock.calls[0].slice(0, 2)).toEqual([
      'hdiutil',
      ['verify', join(directory, 'markdownmeister-1.8.4-macos-arm64.dmg')]
    ])
    for (const tool of ['spctl', 'xcrun']) {
      expect(command.mock.calls.filter(([name]) => name === tool)).toHaveLength(2)
    }
    expect(command.mock.calls.filter(([name]) => name === 'xattr')).toHaveLength(2)
  })

  it('rejects a corrupt downloaded disk image before extraction or assessment', () => {
    command.mockReturnValue({ status: 1, stderr: 'image data corrupted' })
    expect(verify).toThrow('image data corrupted')
    expect(command).toHaveBeenCalledTimes(1)
  })

  it.each(['spctl', 'xcrun'])('blocks publication when %s rejects the contained app', (tool) => {
    const success = command.getMockImplementation()
    if (!success) throw new Error('Missing successful command stub')
    command.mockImplementation((name: string, args: string[]) =>
      name === tool ? { status: 1, stderr: 'verification rejected' } : success(name, args)
    )
    expect(verify).toThrow('verification rejected')
    expect(
      command.mock.calls.some(([name, args]) => name === 'hdiutil' && args[0] === 'detach')
    ).toBe(true)
    expect(command.mock.calls.some(([name]) => name === 'ditto')).toBe(false)
  })
})
