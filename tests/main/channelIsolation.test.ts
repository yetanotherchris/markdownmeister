import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec 038 SC-003 (absolute non-regression rule): the classic channels'
 * registration artifacts must stay byte-identical to the baseline captured
 * when this spec landed. Any edit — even whitespace — fails CI until the
 * baseline is deliberately re-captured in review.
 *
 * markdownmeister.json is compared after stripping release-volatile fields
 * (version, download url, hash): the release bot legitimately rewrites those
 * on every tag. Everything else — shortcuts, install/uninstall hooks, bin
 * shims: the entire REGISTRATION surface — is compared exactly.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const BASELINE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'channel-baseline')

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
    const stripVolatile = (buffer: Buffer): unknown => {
      const parsed = JSON.parse(buffer.toString('utf-8')) as Record<string, unknown> & {
        architecture?: { '64bit'?: Record<string, unknown> }
      }
      delete parsed.version
      delete parsed.architecture?.['64bit']?.url
      delete parsed.architecture?.['64bit']?.hash
      return parsed
    }
    expect(stripVolatile(readRepo('markdownmeister.json'))).toEqual(
      stripVolatile(readBaseline('markdownmeister.json'))
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
