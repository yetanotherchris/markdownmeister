import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

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
      // Replace changing values without hiding missing fields.
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
