import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec 038 SC-003 (absolute non-regression rule): the classic channels'
 * registration artifacts must stay identical to the baseline captured when
 * this spec landed.
 *
 * scripts/installer.nsh and scripts/open-with.ps1 are compared BYTE-for-byte:
 * any edit — even whitespace — fails CI until the baseline is deliberately
 * re-captured in review.
 *
 * markdownmeister.json cannot be byte-compared (the release bot legitimately
 * rewrites release-volatile values on every tag, so a byte fixture would turn
 * every routine release red — plan deviation 2). It is instead parsed and
 * compared DEEPLY after normalising volatile VALUES to fixed sentinels:
 * replacing — never deleting — keeps the KEYS structural, so removing or
 * renaming version/url/hash still fails CI. Everything else — shortcuts,
 * install/uninstall hooks, bin shims: the entire REGISTRATION surface — is
 * compared exactly. Whitespace/key-order churn passes by JSON semantics by
 * design; the two scripts above carry the whitespace guarantee.
 *
 * NOTE: the volatile-value normalisation covers architecture["64bit"] only.
 * Adding an arm64 block to the manifest means extending the loop below in the
 * same commit, or the release bot will break this test on every tag.
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
      // Replace (never delete) volatile values: deletion would mask the
      // accidental loss of a structural KEY, which must still fail.
      if ('version' in parsed) parsed.version = VOLATILE_SENTINEL
      for (const entry of Object.values(parsed.architecture ?? {})) {
        if (!entry || typeof entry !== 'object') continue
        if ('url' in entry) entry.url = VOLATILE_SENTINEL
        if ('hash' in entry) entry.hash = VOLATILE_SENTINEL
      }
      return parsed
    }
    expect(normaliseVolatile(readRepo('markdownmeister.json'))).toEqual(
      normaliseVolatile(readBaseline('markdownmeister.json'))
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
