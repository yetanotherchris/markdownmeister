import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

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
