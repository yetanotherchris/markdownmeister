import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  PLACEHOLDER_IDENTITY_NAME,
  PLACEHOLDER_PUBLISHER,
  identityProblems,
  isPlaceholderIdentity,
  assertRealIdentity,
  toWindowsVersion,
  compareWindowsVersions,
  isVersionGreaterThan,
  parseManifestIdentity,
  manifestProblems
} from '../../scripts/store-submission.mjs'

const SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'store-submission.mjs')
const REAL_IDENTITY = {
  identityName: '12345Chris.MarkdownMeister',
  publisher: 'CN=11111111-2222-3333-4444-555555555555',
  publisherDisplayName: 'Chris Dev'
}

const PROPERTIES = `<Properties><PublisherDisplayName>${REAL_IDENTITY.publisherDisplayName}</PublisherDisplayName></Properties>`

function runCli(args: string[]): void {
  execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf-8', stdio: 'pipe' })
}

describe('store submission: identity guard', () => {
  it('rejects missing and placeholder values', () => {
    expect(isPlaceholderIdentity('', '')).toBe(true)
    expect(isPlaceholderIdentity(PLACEHOLDER_IDENTITY_NAME, REAL_IDENTITY.publisher)).toBe(true)
    expect(isPlaceholderIdentity(REAL_IDENTITY.identityName, PLACEHOLDER_PUBLISHER)).toBe(true)
    expect(identityProblems('', '')).toHaveLength(2)
  })

  it('accepts real Partner Center values', () => {
    expect(isPlaceholderIdentity(REAL_IDENTITY.identityName, REAL_IDENTITY.publisher)).toBe(false)
    expect(identityProblems(REAL_IDENTITY.identityName, REAL_IDENTITY.publisher)).toEqual([])
    expect(() =>
      assertRealIdentity(REAL_IDENTITY.identityName, REAL_IDENTITY.publisher)
    ).not.toThrow()
    expect(() => assertRealIdentity(PLACEHOLDER_IDENTITY_NAME, PLACEHOLDER_PUBLISHER)).toThrow(
      /not submittable/
    )
  })
})

describe('store submission: version derivation', () => {
  it('derives the four-part Store version with a zero revision', () => {
    expect(toWindowsVersion('1.6.58')).toBe('1.6.58.0')
    expect(toWindowsVersion('2.0.1')).toBe('2.0.1.0')
  })

  it('rejects malformed, zero-major, and oversized versions', () => {
    expect(() => toWindowsVersion('1.6')).toThrow(/major\.minor\.patch/)
    expect(() => toWindowsVersion('1.6.58-beta')).toThrow(/major\.minor\.patch/)
    expect(() => toWindowsVersion('0.1.0')).toThrow(/non-zero major/)
    expect(() => toWindowsVersion('1.6.70000')).toThrow(/above 65535/)
  })

  it('compares three- and four-part versions correctly', () => {
    expect(compareWindowsVersions('1.6.58.0', '1.6.57.0')).toBe(1)
    expect(compareWindowsVersions('1.6.58.0', '1.6.58.0')).toBe(0)
    expect(compareWindowsVersions('1.6.58.0', '1.6.59')).toBe(-1)
    expect(isVersionGreaterThan('1.6.58', '1.6.57.0')).toBe(true)
    expect(isVersionGreaterThan('1.6.58', '1.6.58.0')).toBe(false)
    expect(isVersionGreaterThan('1.6.58', '')).toBe(true)
  })
})

describe('store submission: manifest inspection', () => {
  it('reads the Identity element regardless of quote style', () => {
    const single = `<Package><Identity Name='12345Chris.MarkdownMeister' ProcessorArchitecture='x64' Publisher='CN=abc' Version='1.6.58.0' /></Package>`
    const double = `<Package><Identity Name="12345Chris.MarkdownMeister" Publisher="CN=abc" Version="1.6.58.0" /></Package>`
    expect(parseManifestIdentity(single)).toEqual({
      name: '12345Chris.MarkdownMeister',
      publisher: 'CN=abc',
      version: '1.6.58.0'
    })
    expect(parseManifestIdentity(double).version).toBe('1.6.58.0')
  })

  it('reports disagreements between the manifest and the submission inputs', () => {
    const manifest = `<Package><Identity Name="${PLACEHOLDER_IDENTITY_NAME}" Publisher="${PLACEHOLDER_PUBLISHER}" Version="1.6.58.0" /><Properties><PublisherDisplayName>MarkdownMeister</PublisherDisplayName></Properties></Package>`
    const problems = manifestProblems(manifest, { ...REAL_IDENTITY, version: '1.6.58' })
    expect(problems).toHaveLength(3)
    expect(problems.join(' ')).toMatch(/identity name/)
    expect(problems.join(' ')).toMatch(/publisher display name/)

    const agree = `<Package><Identity Name="${REAL_IDENTITY.identityName}" Publisher="${REAL_IDENTITY.publisher}" Version="1.6.58.0" />${PROPERTIES}</Package>`
    expect(manifestProblems(agree, { ...REAL_IDENTITY, version: '1.6.58' })).toEqual([])
  })

  it('reports a publisher display name that disagrees with the account', () => {
    const manifest = `<Package><Identity Name="${REAL_IDENTITY.identityName}" Publisher="${REAL_IDENTITY.publisher}" Version="1.6.58.0" /><Properties><PublisherDisplayName>MarkdownMeister</PublisherDisplayName></Properties></Package>`
    const problems = manifestProblems(manifest, { ...REAL_IDENTITY, version: '1.6.58' })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/publisher display name "MarkdownMeister" does not match/)
  })

  it('reports a packaged version that disagrees with the release version', () => {
    const manifest = `<Package><Identity Name="${REAL_IDENTITY.identityName}" Publisher="${REAL_IDENTITY.publisher}" Version="1.6.57.0" />${PROPERTIES}</Package>`
    const problems = manifestProblems(manifest, { ...REAL_IDENTITY, version: '1.6.58' })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/version "1\.6\.57\.0" does not match "1\.6\.58\.0"/)
  })
})

describe('store submission: CLI gates', () => {
  const base = [
    '--identity-name',
    REAL_IDENTITY.identityName,
    '--publisher',
    REAL_IDENTITY.publisher,
    '--display-name',
    REAL_IDENTITY.publisherDisplayName
  ]

  it('exits non-zero on a placeholder identity', () => {
    expect(() =>
      runCli([
        'validate',
        '--identity-name',
        PLACEHOLDER_IDENTITY_NAME,
        '--publisher',
        REAL_IDENTITY.publisher,
        '--display-name',
        REAL_IDENTITY.publisherDisplayName,
        '--version',
        '1.6.58'
      ])
    ).toThrow()
  })

  it('exits non-zero when the publisher display name is missing', () => {
    expect(() =>
      runCli([
        'validate',
        '--identity-name',
        REAL_IDENTITY.identityName,
        '--publisher',
        REAL_IDENTITY.publisher,
        '--version',
        '1.6.58'
      ])
    ).toThrow()
  })

  it('exits non-zero when the version is not greater than the published one', () => {
    expect(() =>
      runCli(['validate', ...base, '--version', '1.6.58', '--published', '1.6.58.0'])
    ).toThrow()
  })

  it('exits zero for valid inputs and a matching manifest', () => {
    expect(() =>
      runCli(['validate', ...base, '--version', '1.6.58', '--published', '1.6.57.0'])
    ).not.toThrow()

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-store-manifest-'))
    try {
      const manifest = path.join(dir, 'AppxManifest.xml')
      fs.writeFileSync(
        manifest,
        `<Package><Identity Name="${REAL_IDENTITY.identityName}" Publisher="${REAL_IDENTITY.publisher}" Version="1.6.58.0" />${PROPERTIES}</Package>`
      )
      runCli([
        'validate-manifest',
        '--manifest',
        manifest,
        '--identity-name',
        REAL_IDENTITY.identityName,
        '--publisher',
        REAL_IDENTITY.publisher,
        '--display-name',
        REAL_IDENTITY.publisherDisplayName,
        '--version',
        '1.6.58'
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
