import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8').replaceAll('\r\n', '\n')
}

/** The indented block under a top-level `key:` in a YAML file. */
function yamlBlock(text: string, key: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trimEnd() === `${key}:`)
  if (start === -1) throw new Error(`top-level block "${key}" not found`)
  const block: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (index > start && line.length > 0 && !/^\s/.test(line)) break
    block.push(line)
  }
  return block.join('\n')
}

const builder = read('electron-builder.yml')
const appx = yamlBlock(builder, 'appx')
const storeWorkflow = read('.github/workflows/build-store.yml')
const releaseWorkflow = read('.github/workflows/build-release.yml')

describe('store release configuration (FR-011, FR-014, FR-016)', () => {
  it('declares only the runFullTrust capability for the appx target', () => {
    const list = appx.match(/capabilities:\s*\n((?:\s*-\s*\S+\n?)+)/)
    const names = (list?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim().replace(/^-\s*/, ''))
      .filter(Boolean)
    expect(names).toEqual(['runFullTrust'])

    const unusedCapabilities = [
      'internetClient',
      'internetClientServer',
      'documentsLibrary',
      'picturesLibrary',
      'videosLibrary',
      'musicLibrary',
      'removableStorage',
      'broadFileSystemAccess',
      'enterpriseAuthentication',
      'sharedUserCertificates'
    ]
    for (const capability of unusedCapabilities) expect(builder).not.toContain(capability)
  })

  it('does not advertise a file association or protocol the package does not register', () => {
    expect(builder).not.toMatch(/\bfileAssociations:/)
    expect(builder).not.toMatch(/^\s*protocols:/m)
  })

  it('keeps the Store build out of the direct-download release workflow', () => {
    expect(releaseWorkflow).not.toMatch(/\bappx\b/i)
    expect(storeWorkflow).not.toContain('softprops/action-gh-release')
    expect(storeWorkflow).not.toMatch(/updatescoop|updatebrew|updatepackagejson/)
  })

  it('gates the Store build on the submission validator', () => {
    expect(storeWorkflow).toContain('scripts/store-submission.mjs')
    expect(storeWorkflow).toContain('validate-manifest')
  })
})
