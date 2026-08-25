import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile, openSettingsDialog } from './launch'

/**
 * Spec 045 suite: formatting bar visibility. Covers the two-state control in
 * the Markdown area (FR-001), immediate application to open editors (FR-002),
 * complete removal from layout and interaction (FR-003), restart persistence
 * (FR-004), the visible default (FR-005), quiet recovery from a malformed
 * stored value (FR-006), and the source view remaining unaffected (FR-007).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-fbar-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-fbar-config-'))
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
  const dialog = await openSettingsDialog(window)
  await dialog
    .getByTestId('settings-dialog')
    .getByRole('navigation', { name: 'Settings areas' })
    .getByRole('button', { name: 'Markdown' })
    .click()
  await expect(dialog.getByRole('group', { name: 'Markdown', exact: true })).toBeVisible()
  return dialog
}

function formattingBarSwitch(dialog: Page): ReturnType<Page['getByRole']> {
  return dialog.getByRole('checkbox', { name: 'Show the formatting bar' })
}

/** Toggle the pill switch by clicking its visible label row (the hidden native
 *  checkbox cannot be clicked directly; same approach as settings.spec.ts). */
async function toggleFormattingBar(dialog: Page): Promise<void> {
  await dialog.locator('.settings-switch', { hasText: 'Show the formatting bar' }).click()
}

async function closeDialog(): Promise<void> {
  await window.keyboard.press('Escape')
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
}

async function barCenter(): Promise<{ x: number; y: number }> {
  const box = await window.locator('.milkdown-top-bar').boundingBox()
  if (!box) throw new Error('formatting bar has no box while visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('US1 the Markdown area offers a two-state switch defaulting to visible', async () => {
  const dialog = await openMarkdownArea()
  const switchInput = formattingBarSwitch(dialog)
  await expect(switchInput).toBeChecked()
  await expect(window.locator('.app-container')).toHaveAttribute('data-formatting-bar', 'on')
})

test('US1 hiding applies immediately to an open editor without restart or reopen', async () => {
  await openFile(window, 'alpha.md')
  const bar = window.locator('.milkdown-top-bar')
  await expect(bar).toBeVisible()

  const dialog = await openMarkdownArea()
  await toggleFormattingBar(dialog)
  await expect(formattingBarSwitch(dialog)).not.toBeChecked()
  await closeDialog()

  await expect(bar).toBeHidden()
  await expect(window.locator('.app-container')).toHaveAttribute('data-formatting-bar', 'off')

  await openMarkdownArea()
  await toggleFormattingBar(dialog)
  await closeDialog()
  await expect(bar).toBeVisible()
})

test('US2 hiding removes the bar from layout and clicks reach the document beneath', async () => {
  await openFile(window, 'alpha.md')
  const bar = window.locator('.milkdown-top-bar')
  await expect(bar).toBeVisible()
  const center = await barCenter()

  const dialog = await openMarkdownArea()
  await toggleFormattingBar(dialog)
  await closeDialog()

  await expect(bar).toBeHidden()
  const box = await bar.boundingBox()
  expect(box).toBeNull()

  // The point where the bar used to sit now delivers hits to the writing
  // surface, not to a ghost of the bar.
  const hit = await window.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el ? el.className.toString() : ''
    },
    [center.x, center.y]
  )
  expect(hit).not.toContain('top-bar')

  // Tabbing from the document never lands inside the removed bar.
  await window.locator('.ProseMirror').click()
  for (let i = 0; i < 12; i++) await window.keyboard.press('Tab')
  const focusInBar = await window.evaluate(
    () => document.activeElement?.closest('.milkdown-top-bar') !== null
  )
  expect(focusInBar).toBe(false)
})

test('US1 the hidden state persists across an application restart', async () => {
  await openFile(window, 'alpha.md')
  const bar = window.locator('.milkdown-top-bar')
  const dialog = await openMarkdownArea()
  await toggleFormattingBar(dialog)
  await closeDialog()
  await expect(bar).toBeHidden()

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openFile(window, 'alpha.md')
  await expect(window.locator('.milkdown-top-bar')).toBeHidden()

  const reopened = await openMarkdownArea()
  await expect(formattingBarSwitch(reopened)).not.toBeChecked()

  await toggleFormattingBar(reopened)
  await closeDialog()
  await expect(window.locator('.milkdown-top-bar')).toBeVisible()
})

test('FR-006 a malformed stored value falls back to visible quietly', async () => {
  await closeAppSafely(app)
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ settings: { sidebarWidth: 44, formattingBarVisible: 'nope' } })
  )
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openFile(window, 'alpha.md')
  await expect(window.locator('.milkdown-top-bar')).toBeVisible()

  const dialog = await openMarkdownArea()
  await expect(formattingBarSwitch(dialog)).toBeChecked()
})

test('FR-007 an open source view keeps working when the setting hides the bar', async () => {
  await openFile(window, 'alpha.md')
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()

  const dialog = await openMarkdownArea()
  await toggleFormattingBar(dialog)
  await closeDialog()

  await expect(window.getByTestId('source-textarea')).toBeVisible()
  await window.getByTestId('source-textarea').fill('# Alpha\n\nEdited while hidden.')
  const value = await window.getByTestId('source-textarea').textContent()
  expect(value).toContain('Edited while hidden.')
})
