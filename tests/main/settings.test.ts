import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  loadSettingsFile,
  writeSettingsFile,
  hasSettingsKey,
  readConfigFile,
  migrateLegacySettingsFile,
  mergeSettingsPatch,
  materialiseDefaultSettings,
  validateSettingsPatch,
  DEFAULTS
} from '../../src/main/settingsFile'
import type { RecentItem } from '../../src/shared/ipc-contract'

function tempDir(): string {
  return path.join(os.tmpdir(), `mm-settings-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

function tempSettingsFile(content?: string): string {
  const dir = tempDir()
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'config.json')
  if (content !== undefined) {
    fs.writeFileSync(file, content, 'utf-8')
  }
  return file
}

describe('loadSettingsFile', () => {
  it('returns the defaults when the file is missing', () => {
    const result = loadSettingsFile(path.join(os.tmpdir(), 'does-not-exist.json'))
    expect(result).toEqual(DEFAULTS)
    expect(result.explorerVisible).toBe(true)
    expect(result.editorTheme).toBe('rustic')
  })

  it('carries no legacy editorColors/editorFont fields (withdrawn by spec 036)', () => {
    const result = loadSettingsFile(path.join(os.tmpdir(), 'does-not-exist.json'))
    expect('editorColors' in result).toBe(false)
    expect('editorFont' in result).toBe(false)
  })

  it('returns the defaults when the file is malformed', () => {
    const file = tempSettingsFile('{ not json')
    expect(loadSettingsFile(file)).toEqual(DEFAULTS)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('returns the defaults when the file has no settings key', () => {
    const file = tempSettingsFile(JSON.stringify({ recentItems: [] }))
    expect(loadSettingsFile(file)).toEqual(DEFAULTS)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('reads all persisted fields from a valid settings section', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 42,
          themeOverride: 'dark',
          explorerVisible: false,
          editorTheme: 'scholarly',
          spellcheckEnabled: false,
          spellcheckLanguage: 'en-GB',
          fileOpenBehavior: 'new-tab'
        }
      })
    )
    expect(loadSettingsFile(file)).toEqual({
      sidebarWidth: 42,
      themeOverride: 'dark',
      explorerVisible: false,
      editorTheme: 'scholarly',
      spellcheckEnabled: false,
      spellcheckLanguage: 'en-GB',
      fileOpenBehavior: 'new-tab',
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true,
      visualCodeHighlighting: true,
      formattingBarVisible: true,
      wordWrap: false
    })
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('defaults explorerVisible to true when the field is missing (old configs)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: { sidebarWidth: 30, themeOverride: null }
      })
    )
    const result = loadSettingsFile(file)
    expect(result.explorerVisible).toBe(true)
    expect(result.sidebarWidth).toBe(30)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects a non-boolean explorerVisible', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: 'yes'
        }
      })
    )
    expect(loadSettingsFile(file).explorerVisible).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('defaults spellcheckEnabled to true when the field is missing (old configs)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true
        }
      })
    )
    const result = loadSettingsFile(file)
    expect(result.spellcheckEnabled).toBe(true)
    expect(result.sidebarWidth).toBe(30)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('reads spellcheckEnabled false from a valid settings section', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          editorTheme: 'rustic',
          spellcheckEnabled: false
        }
      })
    )
    expect(loadSettingsFile(file).spellcheckEnabled).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects a non-boolean spellcheckEnabled', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          editorTheme: 'rustic',
          spellcheckEnabled: 'yes'
        }
      })
    )
    expect(loadSettingsFile(file).spellcheckEnabled).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('defaults spellcheckLanguage to null when the field is missing (system default)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true
        }
      })
    )
    expect(loadSettingsFile(file).spellcheckLanguage).toBeNull()
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('reads a valid spellcheckLanguage', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          editorTheme: 'rustic',
          spellcheckEnabled: true,
          spellcheckLanguage: 'en-US'
        }
      })
    )
    expect(loadSettingsFile(file).spellcheckLanguage).toBe('en-US')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects an invalid spellcheckLanguage (spec 020: closed union)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          editorTheme: 'rustic',
          spellcheckEnabled: true,
          spellcheckLanguage: 'klingon'
        }
      })
    )
    expect(loadSettingsFile(file).spellcheckLanguage).toBeNull()
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  describe('fileOpenBehavior (spec 008)', () => {
    it('defaults fileOpenBehavior to same-tab when the field is missing (old configs)', () => {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true
          }
        })
      )
      expect(loadSettingsFile(file).fileOpenBehavior).toBe('same-tab')
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    })

    it('reads a valid fileOpenBehavior', () => {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true,
            fileOpenBehavior: 'new-tab'
          }
        })
      )
      expect(loadSettingsFile(file).fileOpenBehavior).toBe('new-tab')
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    })

    it('rejects an invalid fileOpenBehavior (spec 008: closed union)', () => {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true,
            fileOpenBehavior: 'split'
          }
        })
      )
      expect(loadSettingsFile(file).fileOpenBehavior).toBe('same-tab')
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    })

    it('ignores a legacy developerToolsEnabled key (removed in spec 008 clarification 2026-08-08)', () => {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true,
            fileOpenBehavior: 'new-tab',
            developerToolsEnabled: true
          }
        })
      )
      const result = loadSettingsFile(file)
      expect(result.fileOpenBehavior).toBe('new-tab')
      expect('developerToolsEnabled' in result).toBe(false)
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    })
  })

  it('ignores a legacy editorFont value on disk (withdrawn by spec 036)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          editorFont: 'comic-sans'
        }
      })
    )
    const result = loadSettingsFile(file)
    expect('editorFont' in result).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('defaults editorTheme to rustic when the field is missing', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true
        }
      })
    )
    expect(loadSettingsFile(file).editorTheme).toBe('rustic')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('still accepts each of the five default editorTheme names', () => {
    const themes = ['rustic', 'rustic-serif', 'monotone', 'monotone-serif', 'scholarly'] as const
    for (const theme of themes) {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true,
            editorTheme: theme
          }
        })
      )
      expect(loadSettingsFile(file).editorTheme).toBe(theme)
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    }
  })

  it('accepts any well-formed theme-file stem (spec 036: names are file stems)', () => {
    const file = tempSettingsFile(
      JSON.stringify({ settings: { sidebarWidth: 30, editorTheme: 'my-midnight_v2' } })
    )
    expect(loadSettingsFile(file).editorTheme).toBe('my-midnight_v2')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects an invalid editorTheme value (spec 036: bounded name, no path separators)', () => {
    for (const bad of ['../evil', 'a\\b', 'a\nb', '', 'x'.repeat(101)]) {
      const file = tempSettingsFile(
        JSON.stringify({
          settings: {
            sidebarWidth: 30,
            themeOverride: null,
            explorerVisible: true,
            editorTheme: bad
          }
        })
      )
      expect(loadSettingsFile(file).editorTheme).toBe('rustic')
      fs.rmSync(path.dirname(file), { recursive: true, force: true })
    }
  })

  it('keeps recoverable fields from a partially-corrupt file', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 'wide',
          themeOverride: null,
          explorerVisible: false
        }
      })
    )
    expect(loadSettingsFile(file)).toEqual({
      sidebarWidth: 30,
      themeOverride: null,
      explorerVisible: false,
      editorTheme: 'rustic',
      spellcheckEnabled: true,
      spellcheckLanguage: null,
      fileOpenBehavior: 'same-tab',
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true,
      visualCodeHighlighting: true,
      formattingBarVisible: true,
      wordWrap: false
    })
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })
})

describe('writeSettingsFile (shared config, spec 012 FR-002)', () => {
  it('writes a settings section that round-trips', () => {
    const file = tempSettingsFile()
    writeSettingsFile(file, {
      sidebarWidth: 25,
      themeOverride: null,
      explorerVisible: false,
      editorTheme: 'rustic',
      spellcheckEnabled: true,
      spellcheckLanguage: null,
      fileOpenBehavior: 'new-tab',
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true,
      visualCodeHighlighting: false,
      formattingBarVisible: false,
      wordWrap: false
    })
    expect(loadSettingsFile(file)).toEqual({
      sidebarWidth: 25,
      themeOverride: null,
      explorerVisible: false,
      editorTheme: 'rustic',
      spellcheckEnabled: true,
      spellcheckLanguage: null,
      fileOpenBehavior: 'new-tab',
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true,
      visualCodeHighlighting: false,
      formattingBarVisible: false,
      wordWrap: false
    })
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('persists no legacy palette on a fresh write (spec 036: colours live in theme files)', () => {
    const file = tempSettingsFile()
    writeSettingsFile(file, DEFAULTS)
    const written = JSON.parse(fs.readFileSync(file, 'utf-8'))
    expect('editorColors' in written.settings).toBe(false)
    expect('editorFont' in written.settings).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('preserves a pre-existing recentItems key (read-modify-write)', () => {
    const file = tempSettingsFile()
    const recentItems: RecentItem[] = [
      {
        path: '/w/notes.md',
        kind: 'file',
        name: 'notes.md',
        lastOpenedAt: 123
      }
    ]
    fs.writeFileSync(file, JSON.stringify({ recentItems }), 'utf-8')
    writeSettingsFile(file, { ...DEFAULTS, fileOpenBehavior: 'new-tab' })
    const whole = readConfigFile(file)
    expect(whole.recentItems).toEqual(recentItems)
    expect(loadSettingsFile(file).fileOpenBehavior).toBe('new-tab')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('writes a valid config over a malformed one without throwing', () => {
    const file = tempSettingsFile('{ not json')
    writeSettingsFile(file, { ...DEFAULTS, fileOpenBehavior: 'new-tab' })
    expect(loadSettingsFile(file).fileOpenBehavior).toBe('new-tab')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })
})

describe('hasSettingsKey', () => {
  it('is false for a missing file and true once a settings key is written', () => {
    const file = tempSettingsFile(JSON.stringify({ recentItems: [] }))
    expect(hasSettingsKey(file)).toBe(false)
    writeSettingsFile(file, DEFAULTS)
    expect(hasSettingsKey(file)).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })
})

describe('migrateLegacySettingsFile (spec 012, one-time migration)', () => {
  it('imports a legacy flat settings.json into config.json when no settings key exists', () => {
    const configPath = tempSettingsFile(JSON.stringify({ recentItems: [] }))
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        sidebarWidth: 44,
        themeOverride: 'dark',
        explorerVisible: false
      }),
      'utf-8'
    )

    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated).toEqual({
      sidebarWidth: 44,
      themeOverride: 'dark',
      explorerVisible: false,
      editorTheme: 'rustic',
      spellcheckEnabled: true,
      spellcheckLanguage: null,
      fileOpenBehavior: 'same-tab',
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true,
      visualCodeHighlighting: true,
      formattingBarVisible: true,
      wordWrap: false
    })
    // The values are now in config.json (read back through the shared file).
    expect(loadSettingsFile(configPath)).toEqual(migrated)
    expect(hasSettingsKey(configPath)).toBe(true)
    // The recentItems key survived the migration write.
    expect((readConfigFile(configPath) as { recentItems: unknown }).recentItems).toEqual([])
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('does not migrate when config.json already has a settings key', () => {
    const configPath = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 20,
          themeOverride: null,
          explorerVisible: true
        }
      })
    )
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({ sidebarWidth: 44, themeOverride: 'dark', explorerVisible: false }),
      'utf-8'
    )

    expect(migrateLegacySettingsFile(configPath, legacyPath)).toBeNull()
    expect(loadSettingsFile(configPath).sidebarWidth).toBe(20)
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('returns null when the legacy file is missing', () => {
    const configPath = tempSettingsFile()
    expect(
      migrateLegacySettingsFile(configPath, path.join(path.dirname(configPath), 'missing.json'))
    ).toBeNull()
    expect(loadSettingsFile(configPath)).toEqual(DEFAULTS)
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('returns null when the legacy file is not a settings object', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(legacyPath, JSON.stringify({ recentItems: [] }), 'utf-8')
    expect(migrateLegacySettingsFile(configPath, legacyPath)).toBeNull()
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('drops a legacy editorFont key during migration (withdrawn by spec 036)', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        sidebarWidth: 30,
        themeOverride: null,
        explorerVisible: true,
        editorFont: 'cursive'
      }),
      'utf-8'
    )
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect('editorFont' in (migrated ?? {})).toBe(false)
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('migrates a legacy file that lacks the sidebarWidth key', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({ themeOverride: 'dark', explorerVisible: false }),
      'utf-8'
    )
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.themeOverride).toBe('dark')
    expect(migrated?.explorerVisible).toBe(false)
    expect(migrated?.sidebarWidth).toBe(DEFAULTS.sidebarWidth)
    expect(loadSettingsFile(configPath).themeOverride).toBe('dark')
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('imports a valid legacy editorTheme value during migration', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(legacyPath, JSON.stringify({ editorTheme: 'scholarly' }), 'utf-8')
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.editorTheme).toBe('scholarly')
    expect(loadSettingsFile(configPath).editorTheme).toBe('scholarly')
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('defaults editorTheme to rustic when the legacy file lacks it', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(legacyPath, JSON.stringify({ themeOverride: 'dark' }), 'utf-8')
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.editorTheme).toBe('rustic')
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('migrates legacy fileOpenBehavior and ignores the removed developerToolsEnabled key (spec 008)', () => {
    const configPath = tempSettingsFile()
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        fileOpenBehavior: 'new-tab',
        developerToolsEnabled: true
      }),
      'utf-8'
    )
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.fileOpenBehavior).toBe('new-tab')
    expect('developerToolsEnabled' in (migrated ?? {})).toBe(false)
    expect(loadSettingsFile(configPath).fileOpenBehavior).toBe('new-tab')
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })
})

describe('materialiseDefaultSettings (spec 008 clarification 2026-08-09)', () => {
  it('writes the defaults (with the honest closed explorer state) when the file is missing', () => {
    const file = path.join(
      os.tmpdir(),
      `mm-materialise-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      'config.json'
    )
    expect(materialiseDefaultSettings(file, false)).toEqual({ ...DEFAULTS, explorerVisible: false })
    expect(loadSettingsFile(file)).toEqual({ ...DEFAULTS, explorerVisible: false })
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('adds a settings section to a valid config that lacks one, preserving siblings', () => {
    const recentItems: RecentItem[] = [
      { path: '/w/a.md', kind: 'file', name: 'a.md', lastOpenedAt: 1 }
    ]
    const file = tempSettingsFile(JSON.stringify({ recentItems }))
    expect(materialiseDefaultSettings(file, false)).toEqual({ ...DEFAULTS, explorerVisible: false })
    expect(hasSettingsKey(file)).toBe(true)
    expect(readConfigFile(file).recentItems).toEqual(recentItems)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('does not touch a config that already has a settings section', () => {
    const file = tempSettingsFile(
      JSON.stringify({ settings: { sidebarWidth: 42, themeOverride: 'dark' } })
    )
    expect(materialiseDefaultSettings(file, false)).toBeNull()
    expect(loadSettingsFile(file).sidebarWidth).toBe(42)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('never overwrites a malformed config (FR-009 tolerance)', () => {
    const file = tempSettingsFile('{ not json')
    expect(materialiseDefaultSettings(file, false)).toBeNull()
    expect(fs.readFileSync(file, 'utf-8')).toBe('{ not json')
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('never overwrites valid JSON that is not a config object', () => {
    const file = tempSettingsFile(JSON.stringify([1, 2, 3]))
    expect(materialiseDefaultSettings(file, false)).toBeNull()
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual([1, 2, 3])
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('honours the explorerVisible parameter (FR-013 honest closed state)', () => {
    const file = tempSettingsFile()
    materialiseDefaultSettings(file, false)
    expect(loadSettingsFile(file).explorerVisible).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })
})

describe('mergeSettingsPatch (review #27: authoritative in-memory merge)', () => {
  const base: typeof DEFAULTS = { ...DEFAULTS }

  it('rejects a non-finite sidebarWidth', () => {
    expect(mergeSettingsPatch(base, { sidebarWidth: NaN }).sidebarWidth).toBe(30)
    expect(mergeSettingsPatch(base, { sidebarWidth: Infinity }).sidebarWidth).toBe(30)
  })

  it('keeps un-patched fields unchanged', () => {
    const result = mergeSettingsPatch(base, { spellcheckEnabled: false })
    expect(result.sidebarWidth).toBe(30)
    expect(result.explorerVisible).toBe(true)
  })

  it('accepts valid themeOverride values only', () => {
    expect(mergeSettingsPatch(base, { themeOverride: 'dark' }).themeOverride).toBe('dark')
    expect(mergeSettingsPatch(base, { themeOverride: null }).themeOverride).toBe(null)
    expect(mergeSettingsPatch(base, { themeOverride: 'sepia' as 'dark' }).themeOverride).toBe(null)
  })

  it('applies a valid editorTheme patch (any well-formed stem, spec 036)', () => {
    expect(mergeSettingsPatch(base, { editorTheme: 'monotone' }).editorTheme).toBe('monotone')
    expect(mergeSettingsPatch(base, { editorTheme: 'my-midnight' }).editorTheme).toBe('my-midnight')
  })

  it('rejects an invalid editorTheme patch, keeping the current one', () => {
    expect(mergeSettingsPatch(base, { editorTheme: '../evil' }).editorTheme).toBe('rustic')
    expect(mergeSettingsPatch(base, { editorTheme: 'x'.repeat(101) }).editorTheme).toBe('rustic')
  })

  it('applies a boolean spellcheckEnabled patch', () => {
    expect(mergeSettingsPatch(base, { spellcheckEnabled: false }).spellcheckEnabled).toBe(false)
  })

  it('rejects a non-boolean spellcheckEnabled patch, keeping the current one', () => {
    expect(
      mergeSettingsPatch(base, { spellcheckEnabled: 'no' as unknown as boolean }).spellcheckEnabled
    ).toBe(true)
    const off = mergeSettingsPatch(
      { ...base, spellcheckEnabled: false },
      { spellcheckEnabled: 'no' as unknown as boolean }
    )
    expect(off.spellcheckEnabled).toBe(false)
  })

  it('applies a valid spellcheckLanguage patch and accepts null (system default)', () => {
    expect(mergeSettingsPatch(base, { spellcheckLanguage: 'en-GB' }).spellcheckLanguage).toBe(
      'en-GB'
    )
    expect(
      mergeSettingsPatch({ ...base, spellcheckLanguage: 'en-GB' }, { spellcheckLanguage: null })
        .spellcheckLanguage
    ).toBeNull()
  })

  it('rejects an invalid spellcheckLanguage patch, keeping the current one', () => {
    expect(
      mergeSettingsPatch(base, { spellcheckLanguage: 'fr' as 'en-GB' }).spellcheckLanguage
    ).toBeNull()
    const gb = mergeSettingsPatch(
      { ...base, spellcheckLanguage: 'en-GB' },
      { spellcheckLanguage: 'fr' as 'en-GB' }
    )
    expect(gb.spellcheckLanguage).toBe('en-GB')
  })

  it('applies a valid fileOpenBehavior patch', () => {
    expect(mergeSettingsPatch(base, { fileOpenBehavior: 'new-tab' }).fileOpenBehavior).toBe(
      'new-tab'
    )
  })

  it('rejects an invalid fileOpenBehavior patch, keeping the current one', () => {
    expect(
      mergeSettingsPatch(base, { fileOpenBehavior: 'split' as 'new-tab' }).fileOpenBehavior
    ).toBe('same-tab')
    const nt = mergeSettingsPatch(
      { ...base, fileOpenBehavior: 'new-tab' },
      { fileOpenBehavior: 'split' as 'new-tab' }
    )
    expect(nt.fileOpenBehavior).toBe('new-tab')
  })
})

describe('markdown syntax options (spec 030)', () => {
  const MARKDOWN_FIELDS = [
    'hardBreaks',
    'strikethrough',
    'tables',
    'taskLists',
    'math',
    'autolink'
  ] as const

  it('defaults each of the six fields per FR-013 when missing from disk', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true
        }
      })
    )
    const result = loadSettingsFile(file)
    expect(result.hardBreaks).toBe(false)
    expect(result.strikethrough).toBe(true)
    expect(result.tables).toBe(true)
    expect(result.taskLists).toBe(true)
    expect(result.math).toBe(true)
    expect(result.autolink).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('reads each of the six fields from a valid settings section', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          hardBreaks: true,
          strikethrough: false,
          tables: false,
          taskLists: false,
          math: false,
          autolink: false
        }
      })
    )
    const result = loadSettingsFile(file)
    expect(result.hardBreaks).toBe(true)
    expect(result.strikethrough).toBe(false)
    expect(result.tables).toBe(false)
    expect(result.taskLists).toBe(false)
    expect(result.math).toBe(false)
    expect(result.autolink).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects a non-boolean value on disk per-field (tolerant load)', () => {
    const file = tempSettingsFile(
      JSON.stringify({
        settings: {
          sidebarWidth: 30,
          themeOverride: null,
          explorerVisible: true,
          strikethrough: 'yes',
          tables: 'no'
        }
      })
    )
    const result = loadSettingsFile(file)
    expect(result.strikethrough).toBe(true)
    expect(result.tables).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('merges valid boolean patches for the six fields', () => {
    for (const key of MARKDOWN_FIELDS) {
      const patch = { [key]: false } as Partial<typeof DEFAULTS>
      expect(mergeSettingsPatch(DEFAULTS, patch)[key]).toBe(false)
    }
  })

  it('rejects a non-boolean patch, keeping the current value', () => {
    for (const key of MARKDOWN_FIELDS) {
      const patch = { [key]: 'nope' as unknown as boolean }
      expect(mergeSettingsPatch(DEFAULTS, patch)[key]).toBe(DEFAULTS[key])
    }
  })

  it('validateSettingsPatch accepts present booleans and rejects non-booleans (strict, research R5)', () => {
    for (const key of MARKDOWN_FIELDS) {
      expect(() => validateSettingsPatch({ [key]: true })).not.toThrow()
      expect(() => validateSettingsPatch({ [key]: false })).not.toThrow()
      expect(() => validateSettingsPatch({ [key]: 'true' })).toThrow()
      expect(() => validateSettingsPatch({ [key]: 1 })).toThrow()
      expect(() => validateSettingsPatch({ [key]: null })).toThrow()
    }
  })

  it('validateSettingsPatch does not reject an absent markdown field', () => {
    expect(() => validateSettingsPatch({ sidebarWidth: 30 })).not.toThrow()
  })

  it('validateSettingsPatch strictly rejects a PRESENT malformed editorTheme (spec 036)', () => {
    expect(() => validateSettingsPatch({ editorTheme: 'midnight' })).not.toThrow()
    expect(() => validateSettingsPatch({ editorTheme: '../evil' })).toThrow()
    expect(() => validateSettingsPatch({ editorTheme: 7 })).toThrow()
  })
})

describe('visualCodeHighlighting (spec 031)', () => {
  it('defaults to enabled and recovers from a malformed on-disk value', () => {
    const file = tempSettingsFile(JSON.stringify({ settings: { visualCodeHighlighting: 'off' } }))
    expect(DEFAULTS.visualCodeHighlighting).toBe(true)
    expect(loadSettingsFile(file).visualCodeHighlighting).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('persists a valid setting and strictly rejects a malformed IPC patch', () => {
    expect(
      mergeSettingsPatch(DEFAULTS, { visualCodeHighlighting: false }).visualCodeHighlighting
    ).toBe(false)
    expect(() => validateSettingsPatch({ visualCodeHighlighting: false })).not.toThrow()
    expect(() => validateSettingsPatch({ visualCodeHighlighting: 'off' })).toThrow()
  })
})

describe('formattingBarVisible (spec 045)', () => {
  it('defaults to visible and recovers from a malformed on-disk value', () => {
    const file = tempSettingsFile(JSON.stringify({ settings: { formattingBarVisible: 'no' } }))
    expect(DEFAULTS.formattingBarVisible).toBe(true)
    expect(loadSettingsFile(file).formattingBarVisible).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('leaves other settings untouched when recovering a malformed value', () => {
    const file = tempSettingsFile(
      JSON.stringify({ settings: { sidebarWidth: 44, formattingBarVisible: null } })
    )
    const loaded = loadSettingsFile(file)
    expect(loaded.formattingBarVisible).toBe(true)
    expect(loaded.sidebarWidth).toBe(44)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('persists a valid setting and strictly rejects a malformed IPC patch', () => {
    expect(mergeSettingsPatch(DEFAULTS, { formattingBarVisible: false }).formattingBarVisible).toBe(
      false
    )
    expect(() => validateSettingsPatch({ formattingBarVisible: false })).not.toThrow()
    expect(() => validateSettingsPatch({ formattingBarVisible: 'hidden' })).toThrow()
  })

  it('migrates the key from a legacy settings file', () => {
    const configPath = tempSettingsFile(JSON.stringify({ recentItems: [] }))
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(legacyPath, JSON.stringify({ formattingBarVisible: false }))
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.formattingBarVisible).toBe(false)
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })
})

describe('wordWrap (spec 048)', () => {
  it('defaults to disabled and recovers from a malformed on-disk value', () => {
    const file = tempSettingsFile(JSON.stringify({ settings: { wordWrap: 'yes' } }))
    expect(DEFAULTS.wordWrap).toBe(false)
    expect(loadSettingsFile(file).wordWrap).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('leaves other settings untouched when recovering a malformed value', () => {
    const file = tempSettingsFile(JSON.stringify({ settings: { sidebarWidth: 44, wordWrap: 3 } }))
    const loaded = loadSettingsFile(file)
    expect(loaded.wordWrap).toBe(false)
    expect(loaded.sidebarWidth).toBe(44)
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('persists a valid setting and strictly rejects a malformed IPC patch', () => {
    expect(mergeSettingsPatch(DEFAULTS, { wordWrap: true }).wordWrap).toBe(true)
    expect(() => validateSettingsPatch({ wordWrap: true })).not.toThrow()
    expect(() => validateSettingsPatch({ wordWrap: 'on' })).toThrow()
  })

  it('migrates the key from a legacy settings file', () => {
    const configPath = tempSettingsFile(JSON.stringify({ recentItems: [] }))
    const legacyPath = path.join(path.dirname(configPath), 'settings.json')
    fs.writeFileSync(legacyPath, JSON.stringify({ wordWrap: true }))
    const migrated = migrateLegacySettingsFile(configPath, legacyPath)
    expect(migrated?.wordWrap).toBe(true)
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })
})
