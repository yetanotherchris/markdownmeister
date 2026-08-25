import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  closeAppSafely,
  launchApp,
  messageBoxCallCount,
  openFile,
  openSettingsDialog
} from './launch'

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

async function barGeometry(): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await window.locator('.milkdown-top-bar').boundingBox()
  if (!box) throw new Error('formatting bar has no box while visible')
  return box
}

/** Viewport-relative top edge of the first element matching `selector`. */
function rectTop(selector: string): Promise<number> {
  return window.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`${sel} not found`)
    return el.getBoundingClientRect().top
  }, selector)
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

  // Measure everything the hide must change before anything moves.
  const formerBar = await barGeometry()
  const proseTopBefore = await rectTop('.ProseMirror')
  const headerTopBefore = await rectTop('.header-bar')

  const dialog = await openMarkdownArea()

  // Park focus on a formatting button underneath the dialog, then flip the
  // switch with a synthetic click: unlike a real click it does not move
  // focus, so the bar disappears while its own button still holds focus.
  await bar.getByRole('button').first().focus()
  const focusBeforeHide = await window.evaluate(() =>
    Boolean(document.activeElement?.closest('.milkdown-top-bar'))
  )
  expect(focusBeforeHide).toBe(true)
  await formattingBarSwitch(dialog).evaluate((el) => (el as HTMLInputElement).click())
  await expect(formattingBarSwitch(dialog)).not.toBeChecked()
  await closeDialog()

  await expect(bar).toBeHidden()
  expect(await bar.boundingBox()).toBeNull()

  // Zero reserved height, SC-005: the point at the top of the former bar slot
  // now hits the writing surface itself, not merely something that is not the
  // bar.
  const hitChain = await window.evaluate(
    ([x, y]) => {
      const classes: string[] = []
      for (let node = document.elementFromPoint(x, y); node; node = node.parentElement) {
        classes.push(node.className.toString())
      }
      return classes.join(' ')
    },
    [formerBar.x + formerBar.width / 2, formerBar.y + 2]
  )
  expect(hitChain).toContain('ProseMirror')
  expect(hitChain).not.toContain('top-bar')

  // The writing surface climbed up by the bar's height while the header stayed
  // put, so the freed space went into the editing area.
  const proseTopAfter = await rectTop('.ProseMirror')
  const collapsed = proseTopBefore - proseTopAfter
  expect(Math.abs(collapsed - formerBar.height)).toBeLessThanOrEqual(3)
  expect(Math.abs((await rectTop('.header-bar')) - headerTopBefore)).toBeLessThanOrEqual(3)

  // Focus evicted from the removed bar lands somewhere sane, not nowhere.
  const focusState = await window.evaluate(() => {
    const active = document.activeElement
    return {
      inBar: Boolean(active && active.closest('.milkdown-top-bar')),
      placed: active === document.body || Boolean(active && active.closest('.app-container'))
    }
  })
  expect(focusState.inBar).toBe(false)
  expect(focusState.placed).toBe(true)

  // Tabbing from the document never lands inside the removed bar.
  await window.locator('.ProseMirror').click()
  for (let i = 0; i < 12; i++) await window.keyboard.press('Tab')
  const focusInBar = await window.evaluate(() =>
    Boolean(document.activeElement && document.activeElement.closest('.milkdown-top-bar'))
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
  // Quietly (SC-004) means no native error dialog on the malformed value.
  expect(await messageBoxCallCount(app)).toBe(0)

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
