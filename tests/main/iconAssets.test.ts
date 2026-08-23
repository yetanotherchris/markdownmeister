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
 */

const repoRoot = path.resolve(__dirname, '..', '..')
const masterPngPath = path.join(repoRoot, 'assets', 'icon', 'master.png')
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

/** Parse the mandatory IHDR chunk that immediately follows the PNG signature. */
function parsePngIhdr(bytes: Buffer): PngIhdr {
  const signatureOk =
    bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG' && bytes[4] === 0x0d
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
    // Ascending chunk lengths mirror ascending icon sizes (ic07 smallest … ic10 largest).
    const lengths = chunks.map((chunk) => chunk.length)
    const sorted = [...lengths].sort((a, b) => a - b)
    expect(sorted).toEqual(lengths)
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
    expect(chunk.length).toBe(8 + chunk.body.length)
    const ihdr = parsePngIhdr(Buffer.from(chunk.body))
    expect(ihdr.width).toBe(size)
    expect(ihdr.height).toBe(size)
    expect(ihdr.colourType).toBe(6)
  })
})
