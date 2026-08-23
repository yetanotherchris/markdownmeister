import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  ensureThemesDirectory,
  listThemes,
  resolveCaseCollisions,
  seedMissingDefaultThemes
} from '../../../src/main/themes/store'
import {
  MAX_THEME_FILE_BYTES,
  isValidEditorThemeName,
  parseThemeFile,
  themeStemOf
} from '../../../src/main/themes/validate'

/**
 * Spec 036 (data-model §Validation rules): the seeding and discovery matrix.
 * Seeding must produce exactly the five defaults with embedded content and
 * never rewrite an existing file; discovery must reject every malformed shape
 * quietly while valid themes keep working (US5).
 */

let dir: string

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
}

function writeTheme(name: string, contents: unknown | string): void {
  const text = typeof contents === 'string' ? contents : JSON.stringify(contents)
  fs.writeFileSync(path.join(dir, name), text, 'utf-8')
}

const VALID = {
  typeface: 'Test Sans, sans-serif',
  light: {
    background: '#111111',
    foreground: '#eeeeee',
    accent: '#123456',
    surface: '#222222',
    outline: '#333333',
    code: '#444444'
  },
  dark: {
    background: '#000000',
    foreground: '#ffffff',
    accent: '#654321',
    surface: '#0f0f0f',
    outline: '#333333',
    code: '#cccccc'
  }
}

beforeEach(() => {
  dir = tempDir('mm-themes-store')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('themeStemOf / isValidEditorThemeName', () => {
  it('accepts json names with a bounded stem', () => {
    expect(themeStemOf('rustic.json')).toBe('rustic')
    expect(themeStemOf('Rustic.JSON')).toBe('Rustic')
  })

  it('treats wrong-extension and hidden files as invisible (not errors)', () => {
    expect(themeStemOf('notes.txt')).toBeNull()
    expect(themeStemOf('.hidden.json')).toBeNull()
    expect(themeStemOf('.tmp')).toBeNull()
  })

  it('rejects path fragments, control characters, and oversized stems', () => {
    expect(isValidEditorThemeName('a/b')).toBe(false)
    expect(isValidEditorThemeName('a\\b')).toBe(false)
    expect(isValidEditorThemeName('a\u0000b')).toBe(false)
    expect(isValidEditorThemeName('x'.repeat(101))).toBe(false)
    expect(isValidEditorThemeName('x'.repeat(100))).toBe(true)
    expect(isValidEditorThemeName('')).toBe(false)
  })
})

describe('parseThemeFile', () => {
  it('accepts a well-formed file and ignores unknown extra keys', () => {
    const result = parseThemeFile(JSON.stringify({ ...VALID, author: 'someone' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.theme.typeface).toBe(VALID.typeface)
      expect(result.theme.light).toEqual(VALID.light)
      expect(result.theme.dark).toEqual(VALID.dark)
    }
  })

  it('rejects invalid JSON, non-objects, and arrays', () => {
    expect(parseThemeFile('{ not json').ok).toBe(false)
    expect(parseThemeFile('42').ok).toBe(false)
    expect(parseThemeFile('[1]').ok).toBe(false)
  })

  it('rejects a missing dark node or missing light node', () => {
    const withoutDark = { typeface: 'X', light: VALID.light }
    const withoutLight = { typeface: 'X', dark: VALID.dark }
    expect(parseThemeFile(JSON.stringify(withoutDark)).ok).toBe(false)
    expect(parseThemeFile(JSON.stringify(withoutLight)).ok).toBe(false)
  })

  it('rejects missing tokens, bad colours, and wrong token types', () => {
    const noCode = { ...VALID, light: { ...VALID.light } }
    delete (noCode.light as Record<string, unknown>).code
    expect(parseThemeFile(JSON.stringify(noCode)).ok).toBe(false)
    expect(
      parseThemeFile(JSON.stringify({ ...VALID, light: { ...VALID.light, background: 'red' } })).ok
    ).toBe(false)
    expect(
      parseThemeFile(JSON.stringify({ ...VALID, dark: { ...VALID.dark, accent: 7 } })).ok
    ).toBe(false)
  })

  it('rejects an invalid or control-character typeface', () => {
    expect(parseThemeFile(JSON.stringify({ ...VALID, typeface: '' })).ok).toBe(false)
    expect(parseThemeFile(JSON.stringify({ ...VALID, typeface: 5 })).ok).toBe(false)
    expect(parseThemeFile(JSON.stringify({ ...VALID, typeface: 'a\nb' })).ok).toBe(false)
  })
})

describe('seedMissingDefaultThemes', () => {
  it('creates exactly the five defaults in a fresh folder', () => {
    ensureThemesDirectory(dir)
    seedMissingDefaultThemes(dir)
    expect(fs.readdirSync(dir).sort()).toEqual([
      'monotone-serif.json',
      'monotone.json',
      'rustic-serif.json',
      'rustic.json',
      'scholarly.json'
    ])
  })

  it('seeds files that parse to the embedded contents', () => {
    ensureThemesDirectory(dir)
    seedMissingDefaultThemes(dir)
    const outcome = listThemes(dir)
    expect(outcome.themes.map((t) => t.name)).toEqual([
      'monotone',
      'monotone-serif',
      'rustic',
      'rustic-serif',
      'scholarly'
    ])
    expect(outcome.invalidNames).toEqual([])
    const rustic = outcome.themes.find((t) => t.name === 'rustic')
    expect(rustic?.light.background).toBe('#fdf6e3')
    const monotone = outcome.themes.find((t) => t.name === 'monotone')
    expect(monotone?.light.background).toBe('#ffffff')
    expect(monotone?.dark.background).toBe('#000000')
  })

  it('NEVER rewrites an existing default file (FR-007)', () => {
    ensureThemesDirectory(dir)
    fs.writeFileSync(path.join(dir, 'rustic.json'), 'USER EDITS', 'utf-8')
    seedMissingDefaultThemes(dir)
    expect(fs.readFileSync(path.join(dir, 'rustic.json'), 'utf-8')).toBe('USER EDITS')
    // The other four are still seeded.
    expect(fs.existsSync(path.join(dir, 'scholarly.json'))).toBe(true)
  })
})

describe('listThemes discovery matrix', () => {
  function seed(): void {
    ensureThemesDirectory(dir)
    seedMissingDefaultThemes(dir)
  }

  it('lists a valid added theme alongside intact others (US4 S1)', () => {
    seed()
    writeTheme('midnight.json', VALID)
    const outcome = listThemes(dir)
    expect(outcome.themes.map((t) => t.name)).toContain('midnight')
    expect(outcome.themes).toHaveLength(6)
    expect(outcome.invalidNames).toEqual([])
  })

  it('sorts alphabetically by name (code-unit order)', () => {
    seed()
    writeTheme('aardvark.json', VALID)
    writeTheme('Zebra.json', VALID)
    const outcome = listThemes(dir)
    const names = outcome.themes.map((t) => t.name)
    expect(names).toEqual([...names].sort())
    expect(names.indexOf('Zebra')).toBeLessThan(names.indexOf('aardvark'))
  })

  it.each([
    ['bad-json.json', '{ broken'],
    ['missing-dark.json', JSON.stringify({ typeface: 'X', light: VALID.light })],
    ['bad-color.json', JSON.stringify({ ...VALID, light: { ...VALID.light, code: 'red' } })]
  ])('excludes %s quietly and keeps valid themes working (US5)', (name, content) => {
    seed()
    writeTheme(name, content)
    const outcome = listThemes(dir)
    expect(outcome.invalidNames).toContain(name)
    expect(outcome.themes.find((t) => t.name === 'rustic')).toBeTruthy()
    expect(outcome.themes.some((t) => t.name === name.replace('.json', ''))).toBe(false)
  })

  it('ignores subdirectories, other extensions, and hidden files entirely', () => {
    seed()
    fs.mkdirSync(path.join(dir, 'folder.json'))
    fs.mkdirSync(path.join(dir, '.hiddendir'))
    writeTheme('notes.txt', 'hello')
    writeTheme('.secret.json', VALID)
    const outcome = listThemes(dir)
    expect(outcome.themes).toHaveLength(5)
    expect(outcome.invalidNames).toEqual([])
  })

  it('rejects an oversized file without stalling (edge case)', () => {
    seed()
    const junk = 'x'.repeat(MAX_THEME_FILE_BYTES + 1)
    writeTheme('huge.json', junk)
    const outcome = listThemes(dir)
    expect(outcome.invalidNames).toContain('huge.json')
    expect(outcome.themes).toHaveLength(5)
  })

  it('reports an unreadable file quietly (spec edge case)', () => {
    seed()
    const target = path.join(dir, 'locked.json')
    writeTheme('locked.json', VALID)
    fs.chmodSync(target, 0o000)
    try {
      const outcome = listThemes(dir)
      // On Windows, read may still succeed for the owner; either way the app
      // must not throw and valid themes survive.
      if (outcome.invalidNames.includes('locked.json')) {
        expect(outcome.themes).toHaveLength(5)
      }
    } finally {
      fs.chmodSync(target, 0o644)
    }
  })

  it('yields at most one theme for a case-variant duplicate name (edge case)', () => {
    seed()
    // On a case-insensitive filesystem this overwrites rustic.json; on a
    // case-sensitive one both files exist. Either way: exactly one theme.
    writeTheme('Rustic.json', VALID)
    const outcome = listThemes(dir)
    expect(outcome.themes.filter((t) => t.name.toLowerCase() === 'rustic')).toHaveLength(1)
  })

  describe('resolveCaseCollisions (pure rule, portable to case-sensitive FS)', () => {
    const c = (fileName: string) => ({ fileName, stem: fileName.replace(/\.json$/i, '') })

    it('keeps the lexicographically smallest file name and reports the losers', () => {
      const { winners, losers } = resolveCaseCollisions([c('rustic.json'), c('Rustic.json')])
      expect(winners.map((w) => w.fileName)).toEqual(['Rustic.json'])
      expect(losers).toEqual(['rustic.json'])
    })

    it('groups by lowercased stem and handles more than two duplicates', () => {
      const { winners, losers } = resolveCaseCollisions([
        c('monotone.json'),
        c('MONOtone.json'),
        c('monotone.JSON')
      ])
      expect(winners).toHaveLength(1)
      expect(winners[0].fileName).toBe('MONOtone.json')
      expect(losers.sort()).toEqual(['monotone.JSON', 'monotone.json'])
    })

    it('never yields two winners with the same lowercased stem', () => {
      const { winners } = resolveCaseCollisions([
        c('a.json'),
        c('A.JSON'),
        c('b.json'),
        c('B.json')
      ])
      const lower = winners.map((w) => w.stem.toLowerCase())
      expect(new Set(lower).size).toBe(lower.length)
    })
  })

  it('never yields two identically named themes across many collisions', () => {
    seed()
    writeTheme('MONOtone.json', VALID)
    writeTheme('monotone.JSON', { ...VALID, typeface: 'A, sans-serif' })
    const outcome = listThemes(dir)
    const lower = outcome.themes.map((t) => t.name.toLowerCase())
    expect(new Set(lower).size).toBe(lower.length)
  })

  it('does not follow a symlink/junction pointing outside the folder (FR-011)', () => {
    seed()
    const outsideDir = tempDir('mm-themes-outside')
    try {
      const outsideFile = path.join(outsideDir, 'secret.json')
      fs.writeFileSync(outsideFile, JSON.stringify(VALID), 'utf-8')
      const linkPath = path.join(dir, 'evil.json')
      let created = false
      try {
        fs.symlinkSync(outsideFile, linkPath, 'file')
        created = true
      } catch {
        // Windows without privilege cannot create file symlinks; a junction
        // (directory link) needs none and exercises the same regular-file
        // filter (research E9).
        try {
          fs.symlinkSync(outsideDir, linkPath, 'junction')
          created = true
        } catch {
          created = false
        }
      }
      if (!created) return
      const outcome = listThemes(dir)
      expect(outcome.themes.find((t) => t.name === 'evil')).toBeUndefined()
      expect(outcome.invalidNames).toContain('evil.json')
      expect(outcome.themes).toHaveLength(5)
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })
})
