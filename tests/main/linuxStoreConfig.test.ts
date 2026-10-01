import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  isSemver,
  assertSemver,
  normaliseTag,
  assertVersionMatchesTag,
  containsVersionToken,
  isSnapArtifactName,
  assertSnapArtifactName,
  hasSnapCredentials
} from '../../scripts/linux-store-submission.mjs'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'linux-store-submission.mjs')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8').replaceAll('\r\n', '\n')
}

function runCli(args: string[], env?: NodeJS.ProcessEnv): void {
  execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf-8', stdio: 'pipe', env })
}

// Spec 064: the release gate CI runs before it will build or publish the snap.
describe('linux store submission: release gate', () => {
  it('accepts only a three-part version', () => {
    expect(isSemver('1.7.0')).toBe(true)
    for (const bad of ['1.7', '1.7.0.1', 'v1.7.0', '', '1.7.x']) {
      expect(isSemver(bad)).toBe(false)
      expect(() => assertSemver(bad)).toThrow(/major\.minor\.patch/)
    }
  })

  it('compares the version against the release tag, tolerating a leading v', () => {
    expect(normaliseTag('v1.7.0')).toBe('1.7.0')
    expect(() => assertVersionMatchesTag('1.7.0', 'v1.7.0')).not.toThrow()
    expect(() => assertVersionMatchesTag('1.7.0', '1.7.0')).not.toThrow()
    expect(() => assertVersionMatchesTag('1.7.0', 'v1.8.0')).toThrow(/does not match/)
    expect(() => assertVersionMatchesTag('1.7.0', '')).toThrow(/empty/)
  })

  it('matches the version only as a whole token of the snap artifact name', () => {
    expect(isSnapArtifactName('markdownmeister-1.7.0-linux-x64.snap', '1.7.0')).toBe(true)
    expect(isSnapArtifactName('markdownmeister_1.7.0_amd64.snap', '1.7.0')).toBe(true)
    expect(isSnapArtifactName('markdownmeister-1.6.0-linux-x64.snap', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('other-1.7.0-linux-x64.snap', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('markdownmeister-1.7.0-linux-x64.AppImage', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('markdownmeister-11.7.0-linux-x64.snap', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('markdownmeister-1.7.01-linux-x64.snap', '1.7.0')).toBe(false)
    expect(containsVersionToken('markdownmeister-1.7.0-linux-x64.snap', '1.7.0')).toBe(true)
    expect(containsVersionToken('anything', '')).toBe(false)
    expect(() => assertSnapArtifactName('markdownmeister-1.7.0-linux-x64.snap', '1.8.0')).toThrow(
      /not the markdownmeister snap/
    )
  })

  it('treats a blank or missing credential as absent', () => {
    expect(hasSnapCredentials({})).toBe(false)
    expect(hasSnapCredentials({ SNAPCRAFT_STORE_CREDENTIALS: '   ' })).toBe(false)
    expect(hasSnapCredentials({ SNAPCRAFT_STORE_CREDENTIALS: 'token' })).toBe(true)
  })

  it('fails closed from the command line on every rejected input', () => {
    expect(() => runCli(['validate', '--version', '1.7.0'])).not.toThrow()
    expect(() => runCli(['assert-tag', '--version', '1.7.0', '--ref', 'v1.7.0'])).not.toThrow()

    expect(() => runCli(['validate', '--version', '1.7'])).toThrow()
    expect(() => runCli(['assert-tag', '--version', '1.7.0', '--ref', 'v1.8.0'])).toThrow()
    expect(() =>
      runCli(['check-artifact', '--name', 'other-1.7.0-linux-x64.snap', '--version', '1.7.0'])
    ).toThrow()

    // Force the credential absent rather than inheriting an ambient one.
    const withoutCredential = { ...process.env }
    delete withoutCredential.SNAPCRAFT_STORE_CREDENTIALS
    expect(() => runCli(['require-credentials'], withoutCredential)).toThrow()
    expect(() =>
      runCli(['require-credentials'], { ...process.env, SNAPCRAFT_STORE_CREDENTIALS: 'token' })
    ).not.toThrow()
  })
})

// Spec 064 FR-017: the AppImage's self-written desktop entry must stay
// AppImage-only, so a store build never writes or removes it.
describe('linux channel identity', () => {
  it('writes the folder entry only when running as the AppImage', () => {
    const index = read('src/main/index.ts')
    expect(index).toMatch(/process\.platform !== 'linux' \|\| !process\.env\.APPIMAGE/)
  })

  it('keeps the AppImage entry name distinct from the snap application name', () => {
    const desktopEntry = read('src/main/linuxDesktopEntry.ts')
    const entryName = desktopEntry.match(/DESKTOP_ENTRY_FILE_NAME = '([^']+)'/)?.[1]
    expect(entryName).toBe('markdownmeister.desktop')
    expect(entryName).not.toBe('markdownmeister')
  })
})
