import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec 067: the Windows Store package must ship its own branded tile images.
 * app-builder-lib's AppxTarget reads them from <buildResources>/appx/ and
 * silently substitutes generic SampleAppx art when one is missing, which is the
 * "default image" Store certification rejects. The substitution is invisible in
 * the manifest, so the only way to catch a regression is to assert the asset set,
 * its dimensions, and the configuration that points the target at it.
 */

const repoRoot = path.resolve(__dirname, '..', '..')
const appxDir = path.join(repoRoot, 'resources', 'appx')

interface ExpectedTile {
  name: string
  width: number
  height: number
}

const TILES: ExpectedTile[] = [
  { name: 'StoreLogo.png', width: 50, height: 50 },
  { name: 'Square44x44Logo.png', width: 44, height: 44 },
  { name: 'Square150x150Logo.png', width: 150, height: 150 },
  { name: 'LargeTile.png', width: 310, height: 310 },
  { name: 'SmallTile.png', width: 71, height: 71 },
  // The non-square wide tile is a composition, never a stretched square.
  { name: 'Wide310x150Logo.png', width: 310, height: 150 }
]

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function parsePngIhdr(bytes: Buffer): { width: number; height: number; colourType: number } {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file with a leading IHDR chunk')
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8').replaceAll('\r\n', '\n')
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

describe('Windows Store appx tile assets (spec 067)', () => {
  it.each(TILES)('$name exists as a $width by $height RGBA PNG', ({ name, width, height }) => {
    const file = path.join(appxDir, name)
    expect(fs.existsSync(file), `${file} should exist`).toBe(true)
    const ihdr = parsePngIhdr(fs.readFileSync(file))
    expect(ihdr.width).toBe(width)
    expect(ihdr.height).toBe(height)
    expect(ihdr.colourType).toBe(6)
  })

  it('contains no vendor sample asset that the target would substitute', () => {
    const names = fs.readdirSync(appxDir)
    expect(names.filter((name) => /sampleappx/i.test(name))).toEqual([])
  })

  it('points buildResources at resources so AppxTarget reads resources/appx', () => {
    const directories = yamlBlock(read('electron-builder.yml'), 'directories')
    expect(directories).toMatch(/^\s+buildResources:\s+resources\s*$/m)
  })

  it('sets a tile background matching the artwork rather than the packager default', () => {
    const appx = yamlBlock(read('electron-builder.yml'), 'appx')
    expect(appx).toMatch(/^\s+backgroundColor:\s*["']#222540["']\s*$/m)
    expect(appx).not.toMatch(/^\s+backgroundColor:\s*["']#464646["']\s*$/m)
  })

  it('keeps the derivation wired to emit every tile from the master', () => {
    const script = read('scripts/generate-icons.ps1')
    expect(script).toContain('resources\\appx')
    for (const { name } of TILES) {
      expect(script, `generate-icons.ps1 should emit ${name}`).toContain(name)
    }
  })
})
