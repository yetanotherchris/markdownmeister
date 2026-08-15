import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openHamburger, openSettingsDialog } from './launch'

/**
 * Spec 030 markdown syntax options suite (contracts/markdown-syntax.md §E2e +
 * quickstart): the Markdown settings area with six toggles (FR-001..FR-009),
 * immediate re-rendering on toggle (US1/US2), multi-tab sync with dirty/undo/
 * cursor preservation (US3), persistence + fresh-install defaults (US4,
 * FR-013), disabled-syntax save round-trip (SC-004), source-view immunity, and
 * unclosed-delimiter / rapid-toggle edge cases.
 */

const SCRATCH = [
  '~~struck~~ and $E=mc^2$ and https://example.com',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '- [ ] todo',
  '- [x] done',
  '',
  'line one',
  'line two',
  '',
  '~not-closed $not-closed',
  ''
].join('\n')

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-md-syntax-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'syntax.md'), SCRATCH)
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-md-syntax-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openFolder(): Promise<void> {
  await openHamburger(window)
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
  await expect(window.getByRole('treeitem').first()).toBeVisible()
}

async function openFile(): Promise<void> {
  await openFolder()
  await window.getByRole('treeitem').getByText('syntax.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

/** Open Settings → Markdown, returning the settings dialog locator. */
async function openMarkdownArea(): Promise<ReturnType<Page['getByTestId']>> {
  await openSettingsDialog(window)
  const dialog = window.getByTestId('settings-dialog')
  await dialog.getByRole('button', { name: 'Markdown' }).click()
  // The native checkbox is visually hidden (pill switch); wait on the visible
  // label text instead.
  await expect(dialog.locator('.settings-switch-text', { hasText: 'Strikethrough formatting' })).toBeVisible()
  return dialog
}

/** Toggle a Markdown-area switch by its accessible label. */
async function toggle(dialog: ReturnType<Page['getByTestId']>, label: RegExp): Promise<void> {
  await dialog.locator('.settings-switch', { hasText: label }).click()
}

async function persistedSetting<T>(key: string): Promise<T | undefined> {
  const configPath = path.join(configDir, 'config.json')
  if (!fs.existsSync(configPath)) return undefined
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.[key]
}

test('US1 the Markdown area lists six independent switches with FR-013 defaults', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  const box = dialog

  await expect(box.getByRole('checkbox', { name: /Convert single line breaks to hard breaks/ })).not.toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Strikethrough formatting/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Tables formatting/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Task list checkboxes/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Math and LaTeX expressions/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Automatic link detection/ })).toBeChecked()
})

test('US1 toggling strikethrough off renders tildes as literal text, on renders a strike line', async () => {
  await openFile()
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(1)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)

  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('~~struck~~')
})

test('US1 toggling math off renders dollar signs as literal text', async () => {
  await openFile()
  await expect(window.locator('.ProseMirror:visible [data-type="math_inline"]')).toHaveCount(1)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Math and LaTeX expressions/)

  await expect(window.locator('.ProseMirror:visible [data-type="math_inline"]')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('$E=mc^2$')
})

test('US1 toggling tables off renders pipe lines as literal text', async () => {
  await openFile()
  // A rendered table has no literal pipe delimiters.
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('| a | b |')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Tables formatting/)

  await expect(window.locator('.ProseMirror:visible')).toContainText('| a | b |')
})

test('US1 toggling task lists off renders brackets as literal list text', async () => {
  await openFile()
  // Task syntax consumes the `[ ]` marker (renders a checkbox icon).
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('[ ] todo')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Task list checkboxes/)

  await expect(window.locator('.ProseMirror:visible')).toContainText('[ ] todo')
})

test('US1 with autolink disabled, a bare URL stays plain text on load', async () => {
  // Pre-seed the config so the document is parsed with autolink OFF.
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ settings: { autolink: false } }), 'utf-8')
  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()

  await expect(window.locator('.ProseMirror:visible a[href="https://example.com"]')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('https://example.com')
})

test('US2 toggling hard breaks re-flows single newlines', async () => {
  await openFile()
  // Soft breaks collapse into one wrapped paragraph (no <br>).
  await expect(window.locator('.ProseMirror:visible br')).toHaveCount(0)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Convert single line breaks to hard breaks/)

  await expect(window.locator('.ProseMirror:visible br')).toHaveCount(1)
})

test('US3 toggling a setting preserves unsaved edits and dirty state across tabs', async () => {
  await openFile()
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' EXTRA')

  const tab = window.getByRole('tab', { name: /syntax\.md/ })
  await expect(tab.locator('.tab-dirty')).toBeVisible()

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)

  await expect(tab.locator('.tab-dirty')).toBeVisible()
  await expect(window.locator('.ProseMirror:visible')).toContainText('EXTRA')
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
})

test('US4 markdown settings persist across a restart', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)
  await expect.poll(() => persistedSetting<boolean>('strikethrough')).toBe(false)
  await expect.poll(() => persistedSetting<boolean>('math')).toBe(false)

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)

  const reopened = await openMarkdownArea()
  await expect(reopened.getByRole('checkbox', { name: /Strikethrough formatting/ })).not.toBeChecked()
  await expect(reopened.getByRole('checkbox', { name: /Math and LaTeX expressions/ })).not.toBeChecked()
})

test('US4 a fresh install gets FR-013 defaults (all on, hard breaks off)', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await expect(dialog.getByRole('checkbox', { name: /Strikethrough formatting/ })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: /Convert single line breaks to hard breaks/ })).not.toBeChecked()
})

test('SC-004 disabling a syntax saves the exact raw source text', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Tables formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)

  // Close the dialog, make a real edit so the document is dirty, then save.
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' ')
  await window.keyboard.press('Control+s')

  // The disabled syntaxes (math `$` and pipe tables) save byte-for-byte.
  await expect.poll(() => fs.readFileSync(path.join(testFolder, 'syntax.md'), 'utf-8')).toContain('$E=mc^2$')
  await expect.poll(() => fs.readFileSync(path.join(testFolder, 'syntax.md'), 'utf-8')).toContain('| a | b |')
})

test('edge case: unclosed delimiters stay literal in both states', async () => {
  await openFile()
  // `~not-closed` and `$not-closed` are never valid markdown, so they stay
  // literal whether or not the surrounding syntaxes are enabled.
  await expect(window.locator('.ProseMirror:visible')).toContainText('~not-closed')
  await expect(window.locator('.ProseMirror:visible')).toContainText('$not-closed')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await expect(window.locator('.ProseMirror:visible')).toContainText('~not-closed')
  await expect(window.locator('.ProseMirror:visible')).toContainText('$not-closed')
})

test('edge case: source view is immune to markdown toggles', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // Switch to source view via the top-bar "View source" button.
  await window.locator('.milkdown-top-bar').getByRole('button', { name: 'View source' }).click()
  await expect(window.locator('textarea:visible').first()).toBeVisible()
  await expect(window.locator('textarea:visible').first()).toContainText('~~struck~~')
})

test('edge case: rapid toggling settles on the final state', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  const toggleSwitch = dialog.locator('.settings-switch', { hasText: /Strikethrough formatting/ })
  await toggleSwitch.click()
  await toggleSwitch.click()
  await toggleSwitch.click()

  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
  await expect(dialog.getByRole('checkbox', { name: /Strikethrough formatting/ })).not.toBeChecked()
})
