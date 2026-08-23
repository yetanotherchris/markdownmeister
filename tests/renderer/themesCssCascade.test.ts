import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { EditorColors } from '../../src/shared/ipc-contract'
import { DEFAULT_EDITOR_THEME_FILES } from '../../src/shared/editorThemeTokens'

/**
 * Spec 036 (plan D5, review 2026-08-23): themes.css layers the file-driven
 * tokens over the retained preset blocks with precise precedence — derived
 * tones stay preset-driven for the five default names (unedited defaults
 * render pixel-identically to the previous version), while the six curated
 * tokens + typeface come from the resolved FILE for every discovered theme,
 * monotone included. These tests resolve the cascade in themes.css directly
 * (highest specificity wins, then source order) and pin the exact computed
 * values, so a layering or palette regression fails here.
 */

// jsdom rewrites import.meta.url to an http scheme; resolve from the project
// root vitest always runs in instead.
const CSS_PATH = path.resolve(process.cwd(), 'src/renderer/editor/themes.css')

interface Rule {
  selector: string
  declarations: Record<string, string>
  position: number
}

function parseMilkdownRules(css: string): Rule[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(withoutComments)) !== null) {
    const selector = match[1].trim()
    // Only rules whose subject IS the canvas element set its custom properties.
    if (!selector.endsWith('.milkdown')) continue
    const declarations: Record<string, string> = {}
    for (const declaration of match[2].split(';')) {
      const separator = declaration.indexOf(':')
      if (separator < 0) continue
      declarations[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim()
    }
    rules.push({ selector, declarations, position: rules.length })
  }
  return rules
}

/** Attribute selectors + class selectors; enough to order every rule in this
 *  sheet (the static bases and the derived layer at 3, the monotone blocks and
 *  the curated layer at 4). */
function specificity(selector: string): number {
  return (selector.match(/\[[^\]]*\]/g) ?? []).length + (selector.match(/\./g) ?? []).length
}

interface Env {
  editorTheme: string
  mode: 'light' | 'dark'
}

function matches(selector: string, env: Env): boolean {
  const editorAttr = /\[data-editor-theme(?:='([^']*)')?\]/.exec(selector)
  if (!editorAttr) return false
  if (editorAttr[1] !== undefined && editorAttr[1] !== env.editorTheme) return false
  const modeAttr = /\[data-theme(?:='([^']*)')?\]/.exec(selector)
  if (modeAttr && modeAttr[1] !== undefined && modeAttr[1] !== env.mode) return false
  return true
}

type ThemeVars = Record<string, string>

/** Resolve one custom property for the simulated container state: among the
 *  matching rules declaring it, the most specific wins and ties go to the
 *  later rule (source order), mirroring the cascade. */
function computedToken(rules: Rule[], env: Env, property: string, vars: ThemeVars): string {
  let best: Rule | null = null
  for (const rule of rules) {
    if (!(property in rule.declarations)) continue
    if (!matches(rule.selector, env)) continue
    if (best === null || specificity(rule.selector) >= specificity(best.selector)) best = rule
  }
  if (!best) throw new Error(`no rule sets ${property} for ${JSON.stringify(env)}`)
  const raw = best.declarations[property]
  const reference = /^var\(\s*(--mm-theme-[a-z-]+)\s*,\s*([\s\S]+)\)$/.exec(raw)
  if (!reference) return raw
  return (vars[reference[1]] ?? reference[2]).replace(/\s+/g, ' ').trim()
}

/** The inline `--mm-theme-*` variables App.tsx would feed for a theme file in
 *  a given appearance (plus optional edits a user made to the file). */
function fileVars(
  stem: string,
  mode: 'light' | 'dark',
  overrides: Partial<Record<keyof EditorColors, string>> = {}
): ThemeVars {
  const file = DEFAULT_EDITOR_THEME_FILES[stem]
  if (!file) throw new Error(`no embedded default for ${stem}`)
  const palette: EditorColors = { ...(mode === 'dark' ? file.dark : file.light), ...overrides }
  return {
    '--mm-theme-background': palette.background,
    '--mm-theme-foreground': palette.foreground,
    '--mm-theme-accent': palette.accent,
    '--mm-theme-surface': palette.surface,
    '--mm-theme-outline': palette.outline,
    '--mm-theme-code': palette.code,
    '--mm-theme-font': file.typeface
  }
}

describe('themes.css cascade: file-driven layers over the preset base', () => {
  const rules = parseMilkdownRules(fs.readFileSync(CSS_PATH, 'utf-8'))

  it('keeps every static default on its exact previous derived tones', () => {
    const rustic: Env = { editorTheme: 'rustic', mode: 'light' }
    expect(
      computedToken(rules, rustic, '--crepe-color-surface-low', fileVars('rustic', 'light'))
    ).toBe('#fcefce')
    expect(
      computedToken(rules, rustic, '--crepe-color-on-surface', fileVars('rustic', 'light'))
    ).toBe('#201b13')
    expect(
      computedToken(rules, rustic, '--crepe-color-on-surface-variant', fileVars('rustic', 'light'))
    ).toBe('#4f4539')
    const scholarly: Env = { editorTheme: 'scholarly', mode: 'light' }
    expect(
      computedToken(rules, scholarly, '--crepe-color-surface-low', fileVars('scholarly', 'light'))
    ).toBe('#f2f2f2')
    expect(
      computedToken(rules, scholarly, '--crepe-color-on-surface', fileVars('scholarly', 'light'))
    ).toBe('#1a1a1a')
    expect(
      computedToken(
        rules,
        scholarly,
        '--crepe-color-on-surface-variant',
        fileVars('scholarly', 'light')
      )
    ).toBe('#4d4d4d')
  })

  it('keeps monotone on its appearance-specific derived tones in both modes', () => {
    const light: Env = { editorTheme: 'monotone', mode: 'light' }
    expect(
      computedToken(rules, light, '--crepe-color-surface-low', fileVars('monotone', 'light'))
    ).toBe('#f2f2f2')
    expect(
      computedToken(rules, light, '--crepe-color-on-surface', fileVars('monotone', 'light'))
    ).toBe('#000000')
    expect(
      computedToken(rules, light, '--crepe-color-on-surface-variant', fileVars('monotone', 'light'))
    ).toBe('#404040')
    const dark: Env = { editorTheme: 'monotone', mode: 'dark' }
    expect(
      computedToken(rules, dark, '--crepe-color-surface-low', fileVars('monotone', 'dark'))
    ).toBe('#1a1a1a')
    expect(
      computedToken(rules, dark, '--crepe-color-on-surface', fileVars('monotone', 'dark'))
    ).toBe('#ffffff')
    expect(
      computedToken(rules, dark, '--crepe-color-on-surface-variant', fileVars('monotone', 'dark'))
    ).toBe('#bfbfbf')
  })

  it('lets an edited monotone file recolour the canvas (file tokens beat the preset block)', () => {
    const env: Env = { editorTheme: 'monotone', mode: 'light' }
    expect(
      computedToken(rules, env, '--crepe-color-background', fileVars('monotone', 'light'))
    ).toBe('#ffffff')
    const edited = fileVars('monotone', 'light', { background: '#101010' })
    expect(computedToken(rules, env, '--crepe-color-background', edited)).toBe('#101010')
    // The derived tones stay preset-driven even when the file is edited.
    expect(computedToken(rules, env, '--crepe-color-surface-low', edited)).toBe('#f2f2f2')
  })

  it('keeps an edited default on its base derived tones while curated tokens follow the file', () => {
    const env: Env = { editorTheme: 'rustic', mode: 'light' }
    const edited = fileVars('rustic', 'light', { surface: '#123456' })
    expect(computedToken(rules, env, '--crepe-color-surface', edited)).toBe('#123456')
    expect(computedToken(rules, env, '--crepe-color-surface-low', edited)).toBe('#fcefce')
  })

  it('maps every tone from the file for themes without a preset block', () => {
    const env: Env = { editorTheme: 'midnight', mode: 'dark' }
    const vars: ThemeVars = {
      '--mm-theme-background': '#000000',
      '--mm-theme-foreground': '#eeeeee',
      '--mm-theme-accent': '#3388ff',
      '--mm-theme-surface': '#141414',
      '--mm-theme-outline': '#666666',
      '--mm-theme-code': '#ffcc00',
      '--mm-theme-font': 'Test Serif, serif'
    }
    expect(computedToken(rules, env, '--crepe-color-background', vars)).toBe('#000000')
    expect(computedToken(rules, env, '--crepe-color-surface-low', vars)).toBe('#141414')
    expect(computedToken(rules, env, '--crepe-color-on-surface', vars)).toBe('#eeeeee')
    expect(computedToken(rules, env, '--crepe-color-on-surface-variant', vars)).toBe('#666666')
  })

  it('renders the emergency appearance (rustic) from the fallbacks alone', () => {
    const env: Env = { editorTheme: 'default', mode: 'light' }
    const noVars: ThemeVars = {}
    expect(computedToken(rules, env, '--crepe-color-background', noVars)).toBe('#fdf6e3')
    expect(computedToken(rules, env, '--crepe-color-surface-low', noVars)).toBe('#fcefce')
    expect(computedToken(rules, env, '--crepe-color-on-surface', noVars)).toBe('#201b13')
    expect(computedToken(rules, env, '--crepe-color-on-surface-variant', noVars)).toBe('#4f4539')
  })
})
