import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  closeAppSafely,
  launchApp,
  openSettingsDialog,
  openFile,
  openThemeArea,
  messageBoxCallCount
} from './launch'

/**
 * Spec 036 suite: editor themes are ordinary JSON files in <configDir>/themes.
 * Covers US1 (seeded defaults + persistent selection), US2 (live light/dark
 * following), US3 (edit-a-file customisation + spec-023 migration), US4
 * (add/remove files, safe fallback), and US5 (invalid files fail quiet).
 * Config is isolated per test via the MM_CONFIG_DIR seam (launch.ts).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const THEMES_DIR = () => path.join(configDir, 'themes')

function writeThemeFile(name: string, contents: unknown | string): void {
  const text = typeof contents === 'string' ? contents : JSON.stringify(contents)
  fs.mkdirSync(THEMES_DIR(), { recursive: true })
  fs.writeFileSync(path.join(THEMES_DIR(), name), text, 'utf-8')
}

const MIDNIGHT = {
  typeface: 'Test Serif, serif',
  light: {
    background: '#101010',
    foreground: '#f0f0f0',
    accent: '#3388ff',
    surface: '#1a1a1a',
    outline: '#555555',
    code: '#ffcc00'
  },
  dark: {
    background: '#000000',
    foreground: '#eeeeee',
    accent: '#3388ff',
    surface: '#141414',
    outline: '#666666',
    code: '#ffcc00'
  }
}

function seededConfigSettings(settings: Record<string, unknown>): void {
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ settings }), 'utf-8')
}

async function persistedEditorTheme(): Promise<string | undefined> {
  const configPath = path.join(configDir, 'config.json')
  if (!fs.existsSync(configPath)) return undefined
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.editorTheme
}

/** A Crepe canvas custom property as computed on .milkdown. */
async function canvasTokenNamed(token: string): Promise<string> {
  return window
    .locator('.milkdown')
    .evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), token)
}

/** The Crepe canvas background token as computed on .milkdown. */
async function canvasToken(): Promise<string> {
  return canvasTokenNamed('--crepe-color-background')
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-json-themes-ws-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.\n')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-json-themes-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

test('US1 a fresh start seeds exactly the five default theme files', async () => {
  await openFile(window, 'alpha.md')
  const files = fs.readdirSync(THEMES_DIR()).sort()
  expect(files).toEqual([
    'monotone-serif.json',
    'monotone.json',
    'rustic-serif.json',
    'rustic.json',
    'scholarly.json'
  ])
  // The seeds carry explicit light and dark sets with all six tokens (FR-003).
  const rustic = JSON.parse(fs.readFileSync(path.join(THEMES_DIR(), 'rustic.json'), 'utf-8'))
  expect(Object.keys(rustic.light).sort()).toEqual([
    'accent',
    'background',
    'code',
    'foreground',
    'outline',
    'surface'
  ])
  expect(rustic.light).toEqual(rustic.dark) // static default ships identical sets
  const monotone = JSON.parse(fs.readFileSync(path.join(THEMES_DIR(), 'monotone.json'), 'utf-8'))
  expect(monotone.light.background).toBe('#ffffff')
  expect(monotone.dark.background).toBe('#000000') // follows appearance

  // Unedited defaults keep their exact pre-036 derived tones (plan D5, review
  // finding 2026-08-23): the derived-tone layer must not override the preset
  // blocks' hand-tuned values with coarser six-token mappings.
  await expect.poll(() => canvasTokenNamed('--crepe-color-surface-low')).toBe('#fcefce')
  await expect.poll(() => canvasTokenNamed('--crepe-color-on-surface')).toBe('#201b13')
  await expect.poll(() => canvasTokenNamed('--crepe-color-on-surface-variant')).toBe('#4f4539')
})

test('US1 selecting a theme persists across a relaunch with the same configDir', async () => {
  await openFile(window, 'alpha.md')
  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'scholarly', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(persistedEditorTheme).toBe('scholarly')

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'scholarly')
  await expect.poll(canvasToken).toBe('#ffffff')

  // The dialog still shows it staged (FR-006).
  const reopened = await openSettingsDialog(window)
  await openThemeArea(window)
  await expect(reopened.getByRole('radio', { name: 'scholarly', exact: true })).toBeChecked()
})

test('US3 editing a token in a theme file applies on the next settings open (SC-003)', async () => {
  await openFile(window, 'alpha.md')
  await expect.poll(canvasToken).toBe('#fdf6e3')

  // External edit, no restart.
  const rusticPath = path.join(THEMES_DIR(), 'rustic.json')
  const edited = JSON.parse(fs.readFileSync(rusticPath, 'utf-8'))
  edited.light.background = '#ff0000'
  fs.writeFileSync(rusticPath, JSON.stringify(edited, null, 2), 'utf-8')

  // Reopening the dialog refreshes discovery (FR-012) and the applied colours.
  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await expect(dialog.getByRole('radio', { name: 'rustic', exact: true })).toBeChecked()
  await expect.poll(canvasToken).toBe('#ff0000')

  // Fixing the file restores the theme (US5 S4).
  edited.light.background = '#fdf6e3'
  fs.writeFileSync(rusticPath, JSON.stringify(edited, null, 2), 'utf-8')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  const reopened = await openSettingsDialog(window)
  await openThemeArea(window)
  await expect.poll(canvasToken).toBe('#fdf6e3')
  await reopened.getByRole('button', { name: 'Close', exact: true }).click()
})

test('US3 editing monotone.json recolours the canvas (file tokens beat the preset blocks)', async () => {
  // Regression (review finding 2026-08-23): the [data-theme]-qualified
  // monotone preset blocks used to outrank the file-driven layer, so editing
  // a monotone theme file had no effect.
  await openFile(window, 'alpha.md')
  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'monotone', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(canvasToken).toBe('#ffffff')

  const monotonePath = path.join(THEMES_DIR(), 'monotone.json')
  const edited = JSON.parse(fs.readFileSync(monotonePath, 'utf-8'))
  edited.light.background = '#101010'
  fs.writeFileSync(monotonePath, JSON.stringify(edited, null, 2), 'utf-8')

  const reopened = await openSettingsDialog(window)
  await openThemeArea(window)
  await expect.poll(canvasToken).toBe('#101010')
  await reopened.getByRole('button', { name: 'Close', exact: true }).click()
})

test('US4 a well-formed added file appears at the next dialog open and can be selected', async () => {
  await openFile(window, 'alpha.md')
  writeThemeFile('midnight.json', MIDNIGHT)

  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'midnight', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'midnight')
  await expect.poll(canvasToken).toBe('#101010')
  await expect.poll(persistedEditorTheme).toBe('midnight')
})

test('US4/FR-013 deleting the selected theme falls back silently and repairs the selection', async () => {
  await openFile(window, 'alpha.md')
  writeThemeFile('midnight.json', MIDNIGHT)
  let dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'midnight', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(persistedEditorTheme).toBe('midnight')

  // Delete behind the app's back, then force a re-resolution.
  fs.rmSync(path.join(THEMES_DIR(), 'midnight.json'))
  dialog = await openSettingsDialog(window)
  await openThemeArea(window)

  // A default appearance is active (the emergency default renders rustic's
  // tokens under data-editor-theme="default"), no modal ever appears, and
  // main repairs the stored name (FR-013).
  await expect
    .poll(
      async () => {
        const attribute = await window.locator('.app-container').getAttribute('data-editor-theme')
        return attribute === 'default' || attribute === 'rustic' ? attribute : 'unresolved'
      },
      { timeout: 10_000 }
    )
    .not.toBe('unresolved')
  expect(await messageBoxCallCount(app)).toBe(0)

  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect.poll(persistedEditorTheme).toBe('rustic')

  // The repair survives a restart (no dangling reference).
  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'rustic')
})

test('US5 malformed files are ignored quietly while valid themes keep working', async () => {
  writeThemeFile('broken.json', '{ not json')
  writeThemeFile('half.json', JSON.stringify({ typeface: 'X', light: MIDNIGHT.light }))
  writeThemeFile(
    'badcolor.json',
    JSON.stringify({ ...MIDNIGHT, light: { ...MIDNIGHT.light, background: 'red' } })
  )
  // An indirection pointing OUTSIDE the config directory: never followed.
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-json-themes-outside-'))
  try {
    fs.writeFileSync(path.join(outsideDir, 'secret.json'), JSON.stringify(MIDNIGHT), 'utf-8')
    fs.mkdirSync(THEMES_DIR(), { recursive: true })
    const linkPath = path.join(THEMES_DIR(), 'evil.json')
    try {
      fs.symlinkSync(path.join(outsideDir, 'secret.json'), linkPath, 'file')
    } catch {
      fs.symlinkSync(outsideDir, linkPath, 'junction')
    }
    // A subdirectory is invisible to discovery entirely.
    fs.mkdirSync(path.join(THEMES_DIR(), 'folder.json'))

    const dialog = await openSettingsDialog(window)
    await openThemeArea(window)
    for (const absent of ['broken', 'half', 'badcolor', 'evil']) {
      await expect(dialog.getByRole('radio', { name: absent, exact: true })).toHaveCount(0)
    }
    // All five defaults remain available and selectable (FR-010).
    await expect(dialog.getByRole('radio', { name: 'rustic', exact: true })).toBeVisible()
    // FR-010: the rejections are still indicated — quietly, non-modally.
    const note = dialog.locator('.settings-theme-invalid-note')
    await expect(note).toBeVisible()
    for (const rejected of ['broken.json', 'half.json', 'badcolor.json']) {
      await expect(note).toContainText(rejected)
    }
    await expect(await messageBoxCallCount(app)).toBe(0)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  } finally {
    fs.rmSync(outsideDir, { recursive: true, force: true })
  }
})

test('US3/FR-009 legacy custom-colour config migrates into migrated-custom.json', async () => {
  await closeAppSafely(app)
  const legacyColors = {
    background: '#2b2b2b',
    foreground: '#e6e6e6',
    accent: '#3794ff',
    surface: '#1f1f1f',
    outline: '#6e6e6e',
    code: '#ff9d00'
  }
  seededConfigSettings({
    editorTheme: 'rustic',
    editorFont: 'serif',
    editorColors: legacyColors
  })
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')

  // The migration artifact holds those colours in BOTH sets plus the typeface.
  const migratedPath = path.join(THEMES_DIR(), 'migrated-custom.json')
  const migrated = JSON.parse(fs.readFileSync(migratedPath, 'utf-8'))
  expect(migrated.typeface).toContain('Georgia')
  expect(migrated.light).toEqual(legacyColors)
  expect(migrated.dark).toEqual(legacyColors)

  // Selected automatically, rendered identically, in BOTH appearances.
  await expect(window.locator('.app-container')).toHaveAttribute(
    'data-editor-theme',
    'migrated-custom'
  )
  await expect.poll(canvasToken).toBe('#2b2b2b')
  await window.emulateMedia({ colorScheme: 'dark' })
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(canvasToken).toBe('#2b2b2b')
  await window.emulateMedia({ colorScheme: 'light' })

  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await expect(dialog.getByRole('radio', { name: 'migrated-custom', exact: true })).toBeChecked()
  // Idempotent: no duplicate artifacts appear.
  expect(fs.readdirSync(THEMES_DIR()).filter((f) => f.startsWith('migrated'))).toEqual([
    'migrated-custom.json'
  ])
})

test('US3/FR-009 a real legacy config (explorerVisible set) migrates and the repair survives startup', async () => {
  // Regression (review finding 2026-08-23): the explorer reconcile runs an
  // updateSettings at startup, seeding the settings cache and arming the
  // debounced write BEFORE the migration repaired the selection — the pending
  // write then restored the pre-migration name ~500 ms into the run. Real
  // spec-023 configs always carry explorerVisible: true, so the reconcile
  // acted on every real upgrade; earlier fixtures omitted it and missed this.
  await closeAppSafely(app)
  const scholarlyColors = {
    background: '#ffffff',
    foreground: '#1a1a1a',
    accent: '#00b0e9',
    surface: '#f7f7f7',
    outline: '#8a8a8a',
    code: '#b50000'
  }
  seededConfigSettings({
    sidebarWidth: 280,
    explorerVisible: true,
    editorTheme: 'rustic',
    editorFont: 'sans-serif',
    editorColors: scholarlyColors
  })
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')

  // Past the 500 ms debounced-write window armed during startup: the old
  // ordering reverted the migration's repair right inside this window, and
  // since the reverted name ('rustic') resolves, no FR-013 repair ever fixed
  // it again.
  await expect.poll(persistedEditorTheme, { timeout: 10_000 }).toBe('scholarly')
  await window.waitForTimeout(1_500)
  await openFile(window, 'alpha.md')
  expect(await persistedEditorTheme()).toBe('scholarly')

  // The repair also survives a restart.
  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'scholarly')
})

test('US2 monotone switches palettes live on an appearance toggle; a static default does not', async () => {
  await openFile(window, 'alpha.md')
  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'System default', exact: true }).check()
  await dialog.getByRole('radio', { name: 'monotone', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'light')
  await expect.poll(canvasToken).toBe('#ffffff')

  await window.emulateMedia({ colorScheme: 'dark' })
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark', {
    timeout: 5000
  })
  await expect.poll(canvasToken).toBe('#000000')
  await window.emulateMedia({ colorScheme: 'light' })
  await expect.poll(canvasToken).toBe('#ffffff')

  // A static default ships identical sets: switching changes nothing (S3).
  const dialog2 = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog2.getByRole('radio', { name: 'rustic', exact: true }).check()
  await dialog2.getByRole('button', { name: 'Save' }).click()
  await expect.poll(canvasToken).toBe('#fdf6e3')
  await window.emulateMedia({ colorScheme: 'dark' })
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark', {
    timeout: 5000
  })
  await expect.poll(canvasToken).toBe('#fdf6e3')
  await window.emulateMedia({ colorScheme: 'light' })
})
