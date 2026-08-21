import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const manifestPath = path.resolve(__dirname, '..', '..', 'markdownmeister.json')

interface ScoopManifest {
  version: string
  shortcuts?: unknown
  architecture?: {
    '64bit'?: {
      bin?: unknown
    }
  }
}

function loadManifest(): ScoopManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ScoopManifest
}

describe('scoop manifest shortcut declaration', () => {
  it('declares exactly one Start Menu shortcut', () => {
    const manifest = loadManifest()
    expect(Array.isArray(manifest.shortcuts)).toBe(true)
    expect(manifest.shortcuts).toHaveLength(1)
  })

  it('targets the packaged executable under the product name', () => {
    const manifest = loadManifest()
    const entry = (manifest.shortcuts as unknown[])[0] as unknown[]
    expect(entry[0]).toBe('markdownmeister.exe')
    expect(entry[1]).toBe('MarkdownMeister')
  })

  it('launches without arguments and uses the executable icon', () => {
    const manifest = loadManifest()
    const entry = (manifest.shortcuts as unknown[])[0] as unknown[]
    expect(entry).toHaveLength(2)
  })

  it('keeps the existing path shim alongside the shortcut', () => {
    const manifest = loadManifest()
    const bin = manifest.architecture?.['64bit']?.bin
    expect(Array.isArray(bin)).toBe(true)
  })
})
