import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assembleArtifacts } from '../../scripts/assemble-release-artifacts.mjs'

let root: string
let downloadsDir: string
let artifactsDir: string
const version = '1.8.4'
const groups = {
  'windows-x64': ['markdownmeister-1.8.4-windows-x64.exe', 'markdownmeister-1.8.4-windows-x64.zip'],
  'macos-x64': ['markdownmeister-1.8.4-macos-x64.dmg', 'markdownmeister-1.8.4-macos-x64.zip'],
  'macos-arm64': ['markdownmeister-1.8.4-macos-arm64.dmg', 'markdownmeister-1.8.4-macos-arm64.zip'],
  'linux-x64': ['markdownmeister-1.8.4-linux-x64.AppImage', 'markdownmeister_1.8.4_amd64.deb']
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mm-assemble-'))
  downloadsDir = join(root, 'downloads')
  artifactsDir = join(root, 'release')
  for (const [suffix, names] of Object.entries(groups)) {
    const directory = join(downloadsDir, `artifacts-${suffix}`)
    mkdirSync(directory, { recursive: true })
    for (const name of names) writeFileSync(join(directory, name), `bytes of ${name}`)
  }
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('release artifact assembly', () => {
  it('copies the exact eight artifacts without changing their bytes', () => {
    assembleArtifacts({ downloadsDir, artifactsDir, version })
    expect(readdirSync(artifactsDir).sort()).toEqual(Object.values(groups).flat().sort())
    for (const name of readdirSync(artifactsDir)) {
      expect(readFileSync(join(artifactsDir, name), 'utf8')).toBe(`bytes of ${name}`)
    }
  })

  it('rejects architecture collisions before writing release files', () => {
    writeFileSync(join(downloadsDir, 'artifacts-macos-x64', groups['macos-arm64'][0]), 'collision')
    expect(() => assembleArtifacts({ downloadsDir, artifactsDir, version })).toThrow(
      /Duplicate|Unexpected/
    )
    expect(existsSync(artifactsDir)).toBe(false)
  })

  it.each(['missing', 'empty', 'directory'])('rejects a %s artifact before assembly', (kind) => {
    const file = join(downloadsDir, 'artifacts-macos-arm64', groups['macos-arm64'][0])
    rmSync(file)
    if (kind === 'empty') writeFileSync(file, '')
    if (kind === 'directory') mkdirSync(file)
    expect(() => assembleArtifacts({ downloadsDir, artifactsDir, version })).toThrow(
      /Missing|Invalid/
    )
    expect(existsSync(artifactsDir)).toBe(false)
  })

  it('refuses unexpected build artifacts', () => {
    mkdirSync(join(downloadsDir, 'artifacts-other'))
    expect(() => assembleArtifacts({ downloadsDir, artifactsDir, version })).toThrow(
      'Unexpected build artifact'
    )
  })

  it('leaves an existing destination unchanged', () => {
    mkdirSync(artifactsDir)
    writeFileSync(join(artifactsDir, 'existing'), 'keep')
    expect(() => assembleArtifacts({ downloadsDir, artifactsDir, version })).toThrow()
    expect(readdirSync(artifactsDir)).toEqual(['existing'])
    expect(readFileSync(join(artifactsDir, 'existing'), 'utf8')).toBe('keep')
  })
})
