import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec 039 (FR-001/FR-002/FR-007): structural verification of the committed
 * icon assets. These formats fail silently — a wrong dimension byte, a missing
 * small entry, or a truncated ICNS chunk ships invisibly until some launcher
 * surface renders garbage — so the leading binary structures are parsed here
 * in pure TypeScript against the committed files.
 *
 * The contract is dimensional/structural equivalence (docs/icon-provenance.md,
 * research D6), not byte identity: regenerating the assets must reproduce the
 * same sizes, colour types, ICO directory shape, and ICNS chunk layout.
 *
 * Cross-asset byte identity is asserted only where the derivation chain itself
 * copies bytes verbatim (icon.png ← 512 ladder entry, ICO payloads ← ladder,
 * ic10 body ← master.png). A final block guards FR-007's sync rule: the
 * generator's mirrored geometry constants must keep matching master.svg, so an
 * SVG edit without the matching script edit cannot ship non-derivative artwork.
 */

const repoRoot = path.resolve(__dirname, '..', '..')
const masterPngPath = path.join(repoRoot, 'assets', 'icon', 'master.png')
const windowPngPath = path.join(repoRoot, 'resources', 'icon.png')
const icoPath = path.join(repoRoot, 'resources', 'icon.ico')
const icnsPath = path.join(repoRoot, 'resources', 'icon.icns')

const LADDER_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const

interface PngIhdr {
  width: number
  height: number
  bitDepth: number
  /** PNG colour type: 6 = RGBA (truecolour with alpha). */
  colourType: number
}

/** Full 8-byte PNG magic: 89 50 4E 47 0D 0A 1A 0A. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Parse the mandatory IHDR chunk that immediately follows the PNG signature. */
function parsePngIhdr(bytes: Buffer): PngIhdr {
  const signatureOk = bytes.subarray(0, 8).equals(PNG_SIGNATURE)
  if (!signatureOk || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file with a leading IHDR chunk')
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colourType: bytes[25]
  }
}

function ladderPath(size: number): string {
  return path.join(repoRoot, 'resources', 'icons', `${size}x${size}.png`)
}

describe('PNG ladder (resources/icons)', () => {
  it.each(LADDER_SIZES)('contains a %ix%i RGBA entry with matching IHDR dimensions', (size) => {
    const ihdr = parsePngIhdr(fs.readFileSync(ladderPath(size)))
    expect(ihdr.width).toBe(size)
    expect(ihdr.height).toBe(size)
    expect(ihdr.bitDepth).toBe(8)
    expect(ihdr.colourType).toBe(6)
  })

  it('covers every size the spec requires, including the desktop-entry 256 and theme-completing 512', () => {
    for (const size of LADDER_SIZES) {
      expect(fs.existsSync(ladderPath(size)), `${ladderPath(size)} should exist`).toBe(true)
    }
  })

  it('ships resources/icon.png as a byte copy of the largest ladder entry', () => {
    // The generator's final Copy-Item step (derivation chain). Pinning byte
    // identity means a hand-touched single derived file cannot drift silently
    // from its source while every structural check still passes.
    expect(fs.readFileSync(windowPngPath).equals(fs.readFileSync(ladderPath(512)))).toBe(true)
  })
})

describe('master artwork (assets/icon/master.png)', () => {
  it('is exactly 1024x1024 RGBA lossless PNG', () => {
    const bytes = fs.readFileSync(masterPngPath)
    const ihdr = parsePngIhdr(bytes)
    expect(ihdr.width).toBe(1024)
    expect(ihdr.height).toBe(1024)
    expect(ihdr.bitDepth).toBe(8)
    expect(ihdr.colourType).toBe(6)
  })
})

describe('Windows multi-resolution icon (resources/icon.ico)', () => {
  interface IcoDirectoryEntry {
    widthByte: number
    heightByte: number
    declaredWidth: number
    planes: number
    bitsPerPixel: number
    dataBytes: number
    dataOffset: number
  }

  function readDirectory(bytes: Buffer): { count: number; entries: IcoDirectoryEntry[] } {
    const reserved = bytes.readUInt16LE(0)
    const type = bytes.readUInt16LE(2)
    if (reserved !== 0 || type !== 1) throw new Error('not an ICO file (reserved/type header)')
    const count = bytes.readUInt16LE(4)
    const entries: IcoDirectoryEntry[] = []
    for (let i = 0; i < count; i++) {
      const off = 6 + i * 16
      const widthByte = bytes[off]
      entries.push({
        widthByte,
        heightByte: bytes[off + 1],
        declaredWidth: widthByte === 0 ? 256 : widthByte,
        planes: bytes.readUInt16LE(off + 4),
        bitsPerPixel: bytes.readUInt16LE(off + 6),
        dataBytes: bytes.readUInt32LE(off + 8),
        dataOffset: bytes.readUInt32LE(off + 12)
      })
    }
    return { count, entries }
  }

  it('has a well-formed header: reserved=0, type=1 (icon), seven images', () => {
    const { count } = readDirectory(fs.readFileSync(icoPath))
    expect(count).toBe(7)
  })

  it.each([16, 24, 32, 48, 64, 128, 256])('declares a %i px entry', (size) => {
    const { entries } = readDirectory(fs.readFileSync(icoPath))
    const entry = entries.find((candidate) => candidate.declaredWidth === size)
    expect(entry, `an ICO directory entry of ${size}px should exist`).toBeDefined()
    if (!entry) return
    // Dimension bytes hold 256 as 0 per the ICONDIR format.
    expect(entry.widthByte).toBe(size === 256 ? 0 : size)
    expect(entry.heightByte).toBe(size === 256 ? 0 : size)
    expect(entry.planes).toBe(1)
    expect(entry.bitsPerPixel).toBe(32)
  })

  it('stores each image contiguously after the directory, and every payload is a real PNG', () => {
    const bytes = fs.readFileSync(icoPath)
    const { entries } = readDirectory(bytes)
    let expectedOffset = 6 + entries.length * 16
    for (const entry of entries) {
      expect(entry.dataOffset).toBe(expectedOffset)
      expect(entry.dataBytes).toBeGreaterThan(0)
      expect(entry.dataOffset + entry.dataBytes).toBeLessThanOrEqual(bytes.length)
      expect(bytes.toString('ascii', entry.dataOffset + 1, entry.dataOffset + 4)).toBe('PNG')
      const ihdr = parsePngIhdr(
        bytes.subarray(entry.dataOffset, entry.dataOffset + entry.dataBytes)
      )
      expect(ihdr.width).toBe(entry.declaredWidth)
      expect(ihdr.height).toBe(entry.declaredWidth)
      expect(ihdr.colourType).toBe(6)
      expectedOffset += entry.dataBytes
    }
    expect(expectedOffset).toBe(bytes.length)
  })

  it('embeds each committed ladder PNG verbatim as its payload (derivation chain)', () => {
    const bytes = fs.readFileSync(icoPath)
    const { entries } = readDirectory(bytes)
    for (const entry of entries) {
      const payload = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.dataBytes)
      const size = entry.declaredWidth
      expect(
        payload.equals(fs.readFileSync(ladderPath(size))),
        `the ${size}px ICO payload should equal resources/icons/${size}x${size}.png`
      ).toBe(true)
    }
  })
})

describe('macOS bundled icon (resources/icon.icns)', () => {
  interface IcnsChunk {
    type: string
    length: number
    body: Buffer
  }

  function readChunks(bytes: Buffer): IcnsChunk[] {
    expect(bytes.toString('ascii', 0, 4)).toBe('icns')
    const totalLength = bytes.readUInt32BE(4)
    expect(totalLength).toBe(bytes.length)
    const chunks: IcnsChunk[] = []
    let cursor = 8
    while (cursor < bytes.length) {
      const type = bytes.toString('ascii', cursor, cursor + 4)
      const length = bytes.readUInt32BE(cursor + 4)
      expect(length, `chunk ${type} length must cover its header`).toBeGreaterThanOrEqual(8)
      expect(cursor + length, `chunk ${type} must fit inside the file`).toBeLessThanOrEqual(
        bytes.length
      )
      chunks.push({ type, length, body: bytes.subarray(cursor + 8, cursor + length) })
      cursor += length
    }
    return chunks
  }

  it('starts with the icns magic and its total length field matches the file size', () => {
    const bytes = fs.readFileSync(icnsPath)
    expect(bytes.toString('ascii', 0, 4)).toBe('icns')
    expect(bytes.readUInt32BE(4)).toBe(bytes.length)
  })

  it('contains exactly the ic07/ic08/ic09/ic10 chunks in ascending-size order', () => {
    const chunks = readChunks(fs.readFileSync(icnsPath))
    expect(chunks.map((chunk) => chunk.type)).toEqual(['ic07', 'ic08', 'ic09', 'ic10'])
    // Byte LENGTHS are deliberately not compared for monotonicity: a valid
    // regenerated PNG can encode a larger canvas into fewer bytes than its
    // predecessor, so length ordering goes beyond the ICNS format contract.
    // The per-chunk IHDR assertions below carry the size guarantee instead.
  })

  it.each([
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024]
  ])('encodes chunk %s as a %ix%i PNG', (type, size) => {
    const chunks = readChunks(fs.readFileSync(icnsPath))
    const chunk = chunks.find((candidate) => candidate.type === type)
    if (!chunk) throw new Error(`missing ${type} chunk`)
    const ihdr = parsePngIhdr(Buffer.from(chunk.body))
    expect(ihdr.width).toBe(size)
    expect(ihdr.height).toBe(size)
    expect(ihdr.colourType).toBe(6)
  })

  it('carries the committed master artwork verbatim as its largest chunk body', () => {
    // The generator reads assets/icon/master.png straight into the ic10 body
    // (derivation chain); pinning the bytes keeps the surfaces from drifting.
    const chunks = readChunks(fs.readFileSync(icnsPath))
    const ic10 = chunks.find((chunk) => chunk.type === 'ic10')
    if (!ic10) throw new Error('missing ic10 chunk')
    expect(Buffer.from(ic10.body).equals(fs.readFileSync(masterPngPath))).toBe(true)
  })
})

describe('geometry parity: assets/icon/master.svg <-> generator constants (FR-007)', () => {
  const svg = fs.readFileSync(path.join(repoRoot, 'assets', 'icon', 'master.svg'), 'utf8')
  const script = fs.readFileSync(path.join(repoRoot, 'scripts', 'generate-icon-master.ps1'), 'utf8')

  /** Attributes of the first element with the given tag name (may span lines). */
  function tagAttrs(name: string): Record<string, string> {
    const match = svg.match(new RegExp(`<${name}\\b([^>]*)>`))
    if (!match) throw new Error(`master.svg has no <${name}> element`)
    const attrs: Record<string, string> = {}
    for (const attr of match[1].matchAll(/([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g))
      attrs[attr[1]] = attr[2]
    return attrs
  }

  function psNumber(constName: string): number {
    const match = script.match(new RegExp(`\\$${constName}\\s*=\\s*([0-9.]+)`))
    if (!match) throw new Error(`generate-icon-master.ps1 is missing $${constName}`)
    return Number(match[1])
  }

  function psRgbHex(constName: string): string {
    const match = script.match(
      new RegExp(
        `\\$${constName}\\s*=\\s*\\[System\\.Drawing\\.Color\\]::FromArgb\\(255, (\\d+), (\\d+), (\\d+)\\)`
      )
    )
    if (!match) throw new Error(`generate-icon-master.ps1 is missing $${constName}`)
    return `#${match
      .slice(1, 4)
      .map((c) => Number(c).toString(16).padStart(2, '0'))
      .join('')}`
  }

  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
  if (!viewBox) throw new Error('master.svg is missing its viewBox')
  const canvas = Number(viewBox[1])
  const rect = tagAttrs('rect')
  const gradient = tagAttrs('linearGradient')
  const polyline = tagAttrs('polyline')

  // The script mirrors the SVG ratios rounded to 3 decimals; half that quantum
  // is the comparison tolerance.
  const TOL = 5e-4
  const tileWidthRatio = 1 - 2 * psNumber('TileInsetRatio')

  it('mirrors the tile inset, width and corner radius', () => {
    expect(Math.abs(Number(rect.x) / canvas - psNumber('TileInsetRatio'))).toBeLessThan(TOL)
    expect(Math.abs(Number(rect.width) / canvas - tileWidthRatio)).toBeLessThan(TOL)
    expect(Math.abs(Number(rect.rx) / canvas - psNumber('TileRadiusRatio'))).toBeLessThan(TOL)
  })

  it('mirrors the vertical gradient span', () => {
    expect(gradient.x1).toBe(gradient.x2)
    expect(Math.abs(Number(gradient.y1) / canvas - psNumber('TileInsetRatio'))).toBeLessThan(TOL)
    expect(
      Math.abs((Number(gradient.y2) - Number(gradient.y1)) / canvas - tileWidthRatio)
    ).toBeLessThan(TOL)
  })

  it('mirrors every mark vertex of the polyline', () => {
    const block = script.match(/\$MarkPoints\s*=\s*@([\s\S]*?)\n\)/)
    if (!block) throw new Error('generate-icon-master.ps1 is missing $MarkPoints')
    const marks = [...block[1].matchAll(/X\s*=\s*([0-9.]+);\s*Y\s*=\s*([0-9.]+)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2])
    }))
    const vertices = polyline.points
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
    expect(vertices).toHaveLength(marks.length)
    for (let i = 0; i < marks.length; i++) {
      expect(Math.abs(vertices[i][0] / canvas - marks[i].x)).toBeLessThan(TOL)
      expect(Math.abs(vertices[i][1] / canvas - marks[i].y)).toBeLessThan(TOL)
    }
  })

  it('mirrors the stroke width ratio', () => {
    expect(
      Math.abs(Number(polyline['stroke-width']) / canvas - psNumber('StrokeWidthRatio'))
    ).toBeLessThan(TOL)
  })

  it('mirrors every colour exactly', () => {
    const stops = [...svg.matchAll(/stop-color="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1])
    expect(stops).toHaveLength(2)
    expect(psRgbHex('TileTopColor').toLowerCase()).toBe(stops[0].toLowerCase())
    expect(psRgbHex('TileBottomColor').toLowerCase()).toBe(stops[1].toLowerCase())
    expect(psRgbHex('MarkColor').toLowerCase()).toBe(polyline.stroke.toLowerCase())
  })
})
