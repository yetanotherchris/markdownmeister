import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { searchContents } from '../../src/main/fs/search'

let root: string

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-test-'))
  fs.writeFileSync(path.join(root, 'alpha.md'), '# Alpha\n\nThe quick brown fox.\n')
  fs.writeFileSync(path.join(root, 'beta.md'), '# Beta\n\nNothing to see.\n')
  fs.mkdirSync(path.join(root, 'docs'))
  fs.writeFileSync(path.join(root, 'docs', 'notes.md'), 'Meeting agenda for Tuesday.\n')
  fs.mkdirSync(path.join(root, 'docs', 'sub'))
  fs.writeFileSync(path.join(root, 'docs', 'sub', 'deep.md'), 'walrus cavalry\n')
  // Non-markdown files are never searched.
  fs.writeFileSync(path.join(root, 'alpha.txt'), 'alpha in a text file')
  fs.writeFileSync(path.join(root, 'README.md'), 'ALPHA UPPERCASE\n')
  // A markdown file too large to scan.
  const big = Buffer.alloc(2_000_000, 'x')
  fs.writeFileSync(path.join(root, 'big.md'), big)
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('searchContents (spec 059, R1/R2)', () => {
  it('matches case-insensitively inside file contents', async () => {
    expect(await searchContents(root, 'quick brown')).toEqual(['alpha.md'])
    expect(await searchContents(root, 'QUICK BROWN')).toEqual(['alpha.md'])
  })

  it('searches markdown files only, in every loaded and unloaded folder', async () => {
    expect(await searchContents(root, 'walrus cavalry')).toEqual(['docs/sub/deep.md'])
    expect(await searchContents(root, 'meeting agenda')).toEqual(['docs/notes.md'])
  })

  it('returns posix relative paths in the tree id style', async () => {
    expect(await searchContents(root, 'walrus')).toEqual(['docs/sub/deep.md'])
    expect(await searchContents(root, 'alpha')).toEqual(['alpha.md', 'README.md'])
  })

  it('matches against the whole content, including headings', async () => {
    expect(await searchContents(root, 'Alpha')).toEqual(['alpha.md', 'README.md'])
  })

  it('an empty or whitespace term matches nothing', async () => {
    expect(await searchContents(root, '')).toEqual([])
    expect(await searchContents(root, '   ')).toEqual([])
  })

  it('skips files larger than the scan cap silently', async () => {
    // big.md is 2 MB of x's; the cap is 1 MB, so it is skipped and never
    // matches even though its content contains the needle.
    expect(await searchContents(root, 'x'.repeat(500))).toEqual([])
  })

  it('skips non-markdown files even when they contain the term', async () => {
    expect(await searchContents(root, 'alpha.txt')).toEqual([])
  })
})

describe('searchContents escape containment (constitution II)', () => {
  let escapeRoot: string
  let outside: string

  beforeAll(() => {
    escapeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-escape-'))
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-outside-'))
    fs.writeFileSync(path.join(outside, 'secret.md'), 'top secret needle inside')
    // A symlink inside the root pointing at the outside file/directory. The
    // scan must never follow it, so the outside content never matches.
    try {
      fs.symlinkSync(path.join(outside, 'secret.md'), path.join(escapeRoot, 'leak.md'))
      fs.symlinkSync(outside, path.join(escapeRoot, 'leakdir'))
    } catch {
      // Symlinks may be unavailable (Windows privileges); the test then
      // asserts the non-symlink behaviour only.
    }
  })

  afterAll(() => {
    fs.rmSync(escapeRoot, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('never follows a symlink that points outside the root', async () => {
    if (fs.existsSync(path.join(escapeRoot, 'leak.md'))) {
      expect(await searchContents(escapeRoot, 'top secret needle')).toEqual([])
      expect(await searchContents(escapeRoot, 'leak')).toEqual([])
    }
    if (fs.existsSync(path.join(escapeRoot, 'leakdir'))) {
      expect(await searchContents(escapeRoot, 'top secret needle')).toEqual([])
    }
  })

  it('survives an unreadable directory without throwing', async () => {
    const locked = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-locked-'))
    fs.writeFileSync(path.join(locked, 'ok.md'), 'first unique needle')
    const denied = path.join(locked, 'denied')
    fs.mkdirSync(denied)
    fs.writeFileSync(path.join(denied, 'hidden.md'), 'second unique needle')
    let deniedUnreadable = false
    try {
      fs.chmodSync(denied, 0o000)
      try {
        fs.readdirSync(denied)
      } catch {
        deniedUnreadable = true
      }
    } catch {
      deniedUnreadable = false
    }
    const matches = await searchContents(locked, 'unique needle')
    // On POSIX the denied directory is unreadable and skipped; on Windows the
    // chmod is a no-op and both files match. Either way the scan must not throw.
    expect(matches).toEqual(deniedUnreadable ? ['ok.md'] : ['denied/hidden.md', 'ok.md'])
    try {
      fs.chmodSync(denied, 0o755)
    } catch {
      // best-effort restore so teardown can remove the tree
    }
    fs.rmSync(locked, { recursive: true, force: true })
  })
})