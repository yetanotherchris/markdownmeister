import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

const manifestPath = path.resolve(__dirname, '..', '..', 'markdownmeister.json')

interface ScoopManifest {
  shortcuts?: unknown[][]
  post_install?: string[]
  pre_uninstall?: string[]
  architecture?: {
    '64bit'?: {
      bin?: unknown[][]
    }
  }
}

function loadManifest(): ScoopManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ScoopManifest
}

describe('scoop manifest uniqueness', () => {
  it('is the only tracked file named markdownmeister.json (case-insensitive)', () => {
    // The repo doubles as a scoop bucket; scoop recurses over the whole
    // bucket directory when resolving manifests, so a second file with this
    // name makes it parse both at once — breaking version comparison and
    // silently disabling update detection (phase 41). Full incident notes:
    // tests/main/channelIsolation.test.ts.
    //
    // Tracked files are exactly what a fresh bucket clone contains — what
    // scoop actually scans — so git ls-files models that precisely while
    // ignoring untracked build output by construction. Case-insensitive to
    // match NTFS and scoop's own -Filter behaviour.
    const repoRoot = path.resolve(__dirname, '..', '..')
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf-8'
    })
      .split('\0')
      .filter((file) => /(^|\/)markdownmeister\.json$/i.test(file))
    expect(tracked).toEqual(['markdownmeister.json'])
  })
})

describe('scoop manifest shortcut declaration', () => {
  it('declares exactly one Start Menu shortcut targeting the executable under the product name', () => {
    const manifest = loadManifest()
    expect(manifest.shortcuts).toEqual([['markdownmeister.exe', 'MarkdownMeister']])
  })

  it('keeps the existing path shim alongside the shortcut', () => {
    const manifest = loadManifest()
    expect(manifest.architecture?.['64bit']?.bin).toEqual([['markdownmeister.exe', 'markdownmeister']])
  })

  it('preserves the install hooks the shortcut ships alongside', () => {
    const manifest = loadManifest()
    expect(manifest.post_install).toHaveLength(1)
    expect(manifest.pre_uninstall).toHaveLength(1)
  })
})
