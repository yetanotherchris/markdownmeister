import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile } from './launch'

/**
 * Spec 048 suite: source view word wrap. Covers the two-state Markdown-area
 * control (FR-001), today's behaviour when off (FR-002), wrapped presentation
 * when on (FR-003), immediate application to open source views (FR-004),
 * mid-edit safety (FR-005), persistence and malformed-value recovery (FR-006),
 * and a typing-latency smoke on a large wrapped document (SC-005).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const LONG_LINE = `# Alpha\n\n${'x'.repeat(4000)}\n\nHello world.\n`
const LONG_TOKEN = `# Token\n\n${'a'.repeat(3000)}\n\n${'b'.repeat(3000)}\n`

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-wrap-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), LONG_LINE)
  fs.writeFileSync(path.join(testFolder, 'token.md'), LONG_TOKEN)
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-wrap-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openMarkdownArea(): Promise<Page> {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Settings…' }).click()
  const dialog = window.getByTestId('settings-dialog')
  await dialog.waitFor()
  await dialog
    .getByRole('navigation', { name: 'Settings areas' })
    .getByRole('button', { name: 'Markdown' })
    .click()
  await expect(dialog.getByRole('group', { name: 'Markdown', exact: true })).toBeVisible()
  return window
}

function wordWrapSwitch(dialog: Page): ReturnType<Page['getByRole']> {
  return dialog.getByRole('checkbox', { name: 'Wrap long lines in source view' })
}

async function toggleWordWrap(): Promise<void> {
  const dialog = await openMarkdownArea()
  await dialog.locator('.settings-switch', { hasText: 'Wrap long lines in source view' }).click()
  await window.keyboard.press('Escape')
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
}

/** Whether the CodeMirror scroller overflows horizontally right now. */
async function sourceOverflows(): Promise<boolean> {
  return window.locator('.source-view .cm-scroller').evaluate((el) => {
    return el.scrollWidth > el.clientWidth + 1
  })
}

async function openSourceView(name: string): Promise<void> {
  await openFile(window, name)
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
}

test('US1 the Markdown area offers a two-state switch defaulting to off', async () => {
  const dialog = await openMarkdownArea()
  await expect(wordWrapSwitch(dialog)).not.toBeChecked()
})

test('US1 disabling matches today: long lines overflow with horizontal scrolling', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)
  const scrolled = await window.locator('.source-view .cm-scroller').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
    return el.scrollLeft > 0
  })
  expect(scrolled).toBe(true)
})

test('US1 enabling wraps lines inside the pane immediately, without reopening', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)

  await toggleWordWrap()

  await expect.poll(sourceOverflows).toBe(false)
  // The same source surface is still the live editing area.
  await expect(window.getByTestId('source-textarea')).toBeVisible()
})

test('US1 unbroken tokens break within the pane when wrap is enabled', async () => {
  await openSourceView('token.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)
})

test('US2 toggling mid-edit preserves text, dirty state, and the typing position', async () => {
  await openSourceView('alpha.md')
  const source = window.getByTestId('source-textarea')

  // An unsaved edit marks the tab dirty.
  await source.click()
  await window.keyboard.press('Control+End')
  await window.keyboard.type(' EDITED')
  const alphaTab = window.getByRole('tab', { name: /alpha\.md/ })
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()

  await toggleWordWrap()

  // Text and dirty state survive the toggle.
  await expect(source).toContainText('EDITED')
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()

  // Caret navigation and insertion still land where intended.
  await source.click()
  await window.keyboard.press('Control+Home')
  await window.keyboard.type('START>> ')
  const text = await source.textContent()
  expect(text?.startsWith('START>> # Alpha')).toBe(true)
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()
})

test('US1 the choice persists across a restart', async () => {
  await openSourceView('alpha.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)

  const configPath = path.join(configDir, 'config.json')
  await expect
    .poll(() => {
      if (!fs.existsSync(configPath)) return undefined
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.wordWrap
    })
    .toBe(true)

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(false)
})

test('FR-006 a malformed stored value falls back to disabled quietly', async () => {
  await closeAppSafely(app)
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ settings: { sidebarWidth: 44, wordWrap: 'on' } })
  )
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)

  const dialog = await openMarkdownArea()
  await expect(wordWrapSwitch(dialog)).not.toBeChecked()
})

test('SC-005 typing into a large wrapped document stays responsive', async () => {
  const lines: string[] = []
  for (let i = 0; i < 10000; i++) lines.push(`line ${i} with some prose text`)
  fs.writeFileSync(path.join(testFolder, 'huge.md'), lines.join('\n') + '\n')

  await openSourceView('huge.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)

  const source = window.getByTestId('source-textarea')
  await source.click()
  await window.keyboard.press('Control+Home')
  const started = Date.now()
  await window.keyboard.type('WRAPPED ', { delay: 10 })
  const elapsed = Date.now() - started
  await expect(source).toContainText('WRAPPED')
  // Generous ceiling: ten keystrokes through a wrapped 10k-line buffer.
  expect(elapsed).toBeLessThan(10000)
})
