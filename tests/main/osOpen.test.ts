import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { classifyOsTarget, extractTargetFromArgv } from '../../src/main/osOpen'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Spec 006 adversarial suite (constitution V): OS-supplied paths are untrusted
 * (Principle II), so classification must fail closed — never classify an
 * unavailable, unreadable, wrong-type, or unsupported-extension target as
 * openable, and never leak the path itself into a failure message (FR-011).
 */

function createTempDir(): string {
  const dir = path.join(os.tmpdir(), `mm-osopen-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

describe('classifyOsTarget', () => {
  let dir: string
  let mdFile: string
  let markdownFile: string
  let txtFile: string
  let nestedDir: string

  beforeEach(() => {
    dir = createTempDir()
    mdFile = path.join(dir, 'notes.md')
    markdownFile = path.join(dir, 'notes.markdown')
    txtFile = path.join(dir, 'notes.txt')
    nestedDir = path.join(dir, 'nested')
    fs.writeFileSync(mdFile, '# Notes')
    fs.writeFileSync(markdownFile, '# Notes')
    fs.writeFileSync(txtFile, 'plain')
    fs.mkdirSync(nestedDir)
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('classifies a supported .md file', () => {
    const result = classifyOsTarget(mdFile)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.target.kind).toBe('file')
      expect(result.target.absPath).toBe(fs.realpathSync(mdFile))
    }
  })

  it('classifies a supported .markdown file', () => {
    const result = classifyOsTarget(markdownFile)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.target.kind).toBe('file')
  })

  it('accepts an uppercase extension (case-insensitive)', () => {
    const upper = path.join(dir, 'NOTES.MD')
    fs.writeFileSync(upper, '# Upper')
    const result = classifyOsTarget(upper)
    expect(result.ok).toBe(true)
  })

  it('classifies a directory as a folder', () => {
    const result = classifyOsTarget(nestedDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.target.kind).toBe('folder')
      expect(result.target.absPath).toBe(fs.realpathSync(nestedDir))
    }
  })

  it('rejects an unsupported file extension', () => {
    const result = classifyOsTarget(txtFile)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/not supported/)
  })

  it('rejects a nonexistent path with a path-free message', () => {
    const gone = path.join(dir, 'missing.md')
    const result = classifyOsTarget(gone)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).not.toContain(dir)
      expect(result.message).not.toContain('missing')
    }
  })

  it('rejects a non-string / empty target', () => {
    expect(classifyOsTarget(undefined).ok).toBe(false)
    expect(classifyOsTarget('').ok).toBe(false)
  })

  it('rejects a path that is a symlink to a nonexistent target', () => {
    const link = path.join(dir, 'link.md')
    try {
      fs.symlinkSync(path.join(dir, 'does-not-exist.md'), link)
    } catch {
      // Symlink creation may need privileges on Windows — skip if unsupported.
      return
    }
    const result = classifyOsTarget(link)
    expect(result.ok).toBe(false)
  })

  it('follows a symlink to a supported file (realpath resolution)', () => {
    const link = path.join(dir, 'alias.md')
    try {
      fs.symlinkSync(mdFile, link)
    } catch {
      return
    }
    const result = classifyOsTarget(link)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.target.absPath).toBe(fs.realpathSync(mdFile))
  })
})

describe('extractTargetFromArgv', () => {
  it('returns the target in a dev launch (executable, script, target)', () => {
    const argv = ['/electron.exe', 'out/main/index.js', 'C:\\notes\\a.md']
    expect(extractTargetFromArgv(argv)).toBe('C:\\notes\\a.md')
  })

  it('returns the target in a packaged launch (executable, target)', () => {
    const argv = ['C:\\Program Files\\MarkdownMeister\\markdownmeister.exe', 'C:\\notes\\a.md']
    expect(extractTargetFromArgv(argv)).toBe('C:\\notes\\a.md')
  })

  it('skips switches and the Playwright loader/entry scripts injected before the target', () => {
    const argv = [
      '/electron.exe',
      '-r',
      'node_modules/playwright-core/lib/server/electron/loader.js',
      '--headless',
      '--no-sandbox',
      'out/main/index.js',
      'C:\\notes\\a.md'
    ]
    expect(extractTargetFromArgv(argv)).toBe('C:\\notes\\a.md')
  })

  it('returns the target even when the argv order is shuffled', () => {
    const argv = ['/electron.exe', 'C:\\notes\\a.md', '--headless', 'out/main/index.js']
    expect(extractTargetFromArgv(argv)).toBe('C:\\notes\\a.md')
  })

  it('returns null when there is no target', () => {
    expect(extractTargetFromArgv(['/electron.exe'])).toBe(null)
    expect(extractTargetFromArgv(['/electron.exe', '--flag'])).toBe(null)
    expect(extractTargetFromArgv(['/electron.exe', 'out/main/index.js'])).toBe(null)
    expect(extractTargetFromArgv([])).toBe(null)
  })

  it('ignores the bare working directory that `electron .` passes (dev/preview)', () => {
    expect(extractTargetFromArgv(['/electron.exe', '.'])).toBe(null)
    expect(extractTargetFromArgv(['/electron.exe', '..', '--no-sandbox'])).toBe(null)
  })

  it('only ever treats an absolute path as a target', () => {
    expect(extractTargetFromArgv(['/electron.exe', 'notes.md'])).toBe(null)
    expect(extractTargetFromArgv(['/electron.exe', 'out/main/index.js', 'C:\\notes\\a.md'])).toBe(
      'C:\\notes\\a.md'
    )
  })

  it('does not mistake a markdown file ending in .md for a script', () => {
    const argv = ['/electron.exe', 'out/main/index.js', 'C:\\notes\\report.js.md']
    expect(extractTargetFromArgv(argv)).toBe('C:\\notes\\report.js.md')
  })
})
