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
  it('is the only file in the repository named markdownmeister.json', () => {
    // The repo doubles as a scoop bucket and scoop's manifest lookup recurses
    // over the entire bucket directory. A second markdownmeister.json anywhere
    // (e.g. a test fixture) makes scoop parse both at once, breaking version
    // comparison and silently disabling update detection (phase 41).
    const repoRoot = path.resolve(__dirname, '..', '..')
    const skipped = new Set(['.git', 'node_modules', 'dist', 'out', 'artifacts'])
    const matches: string[] = []
    const stack = [repoRoot]
    while (stack.length > 0) {
      const dir = stack.pop() as string
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!skipped.has(entry.name)) stack.push(path.join(dir, entry.name))
        } else if (entry.isFile() && entry.name === 'markdownmeister.json') {
          matches.push(path.join(dir, entry.name))
        }
      }
    }
    expect(matches).toEqual([manifestPath])
  })

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
