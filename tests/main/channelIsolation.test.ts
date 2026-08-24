import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Keeps channel-registration files unchanged outside the release update.
 *
 * The installer scripts are compared byte-for-byte. The Scoop manifest is
 * compared as JSON after replacing release-managed version, URL, and hash
 * values. Replacing those values instead of removing them detects a missing
 * property while allowing release updates.
 *
 * The baseline fixture must not be named `markdownmeister.json`, because Scoop
 * scans the bucket for manifests and treats a second manifest as another app.
 *
 * The release manifest currently has only a 64-bit architecture entry. Extend
 * the normalization when adding another architecture.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const BASELINE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'channel-baseline')
const VOLATILE_SENTINEL = '<release-volatile>'

function readRepo(relativePath: string): Buffer {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath))
}

function readBaseline(name: string): Buffer {
  return fs.readFileSync(path.join(BASELINE_DIR, name))
}

describe('channel isolation baseline (SC-003)', () => {
  it('keeps scripts/installer.nsh byte-identical', () => {
    expect(readRepo('scripts/installer.nsh').equals(readBaseline('installer.nsh'))).toBe(true)
  })

  it('keeps scripts/open-with.ps1 byte-identical', () => {
    expect(readRepo('scripts/open-with.ps1').equals(readBaseline('open-with.ps1'))).toBe(true)
  })

  it('keeps the markdownmeister.json registration surface identical', () => {
    const normaliseVolatile = (buffer: Buffer): unknown => {
      const parsed = JSON.parse(buffer.toString('utf-8')) as {
        version?: unknown
        architecture?: Record<string, Record<string, unknown> | undefined>
      }
      // Keep the properties so a missing release-managed field still differs.
      if ('version' in parsed) parsed.version = VOLATILE_SENTINEL
      for (const entry of Object.values(parsed.architecture ?? {})) {
        if (!entry || typeof entry !== 'object') continue
        if ('url' in entry) entry.url = VOLATILE_SENTINEL
        if ('hash' in entry) entry.hash = VOLATILE_SENTINEL
      }
      return parsed
    }
    expect(normaliseVolatile(readRepo('markdownmeister.json'))).toEqual(
      normaliseVolatile(readBaseline('scoop-manifest-baseline.json'))
    )
  })

  it('keeps the Scoop register/uninstall hooks pointing at open-with.ps1', () => {
    const manifest = JSON.parse(readRepo('markdownmeister.json').toString('utf-8')) as {
      post_install?: string[]
      pre_uninstall?: string[]
    }
    expect(manifest.post_install).toEqual([
      '& "$dir\\resources\\scripts\\open-with.ps1" -Action register -ExePath "$dir\\markdownmeister.exe"'
    ])
    expect(manifest.pre_uninstall).toEqual([
      '& "$dir\\resources\\scripts\\open-with.ps1" -Action unregister -ExePath "$dir\\markdownmeister.exe"'
    ])
  })
})
