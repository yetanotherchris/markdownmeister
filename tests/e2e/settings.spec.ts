import { test, expect, ElectronApplication, Page, Locator } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openHamburger, openSettingsDialog, openThemeArea } from './launch'

/**
 * Spec 008/016 settings suite (contracts/settings-ui.md §E2e): the Settings
 * dialog with the General/Theme sidebar (FR-001..005), the pill-switch
 * booleans (FR-006), the Save-gated editor theme (spec 016 FR-003/US1 S4),
 * restart persistence, the dirty-document non-interference guarantee
 * (spec 016 FR-014), keyboard access and focus trapping (FR-007), the
 * responsive narrow-width layout (edge case 1), and missing/malformed-config
 * tolerance (spec 016 FR-006).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-settings-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-settings-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
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

/** Open a markdown file so the WYSIWYG editor is mounted. */
async function openFile(): Promise<void> {
  await openFolder()
  await window.getByRole('treeitem').getByText('alpha.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

async function canvasBackground(): Promise<string> {
  return window.locator('.milkdown').evaluate((el) => getComputedStyle(el).backgroundColor)
}

async function persistedSetting<T>(key: string): Promise<T | undefined> {
  const configPath = path.join(configDir, 'config.json')
  if (!fs.existsSync(configPath)) return undefined
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.[key]
}

/** The labelled element that currently holds focus inside the dialog. */
async function focusedElement(): Promise<string> {
  return window.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return ''
    if (el.hasAttribute('name')) return `${el.tagName.toLowerCase()}[name=${el.getAttribute('name')}]`
    return `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim()}`
  })
}

/** Toggle a pill switch by clicking its visible label row (the hidden native
 *  checkbox cannot be `.check()`ed — Playwright needs a visible target). */
async function clickSwitch(dialog: Locator, label: string): Promise<void> {
  await dialog.locator('.settings-switch', { hasText: label }).click()
}

test('US1 the hamburger opens a Settings dialog with a General sidebar selected by default', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')

  // The dialog is a labelled, modal dialog (contracts/settings-ui.md).
  await expect(box.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // FR-002: a sidebar with General and Theme entries is visible.
  const nav = box.getByRole('navigation', { name: 'Settings areas' })
  await expect(nav.getByRole('button', { name: 'General' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Theme' })).toBeVisible()

  // FR-005/FR-003: General is selected on open and only its areas show.
  await expect(nav.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
  await expect(box.getByRole('group', { name: 'Spellcheck' })).toBeVisible()
  await expect(box.getByRole('group', { name: 'Opening Files' })).toBeVisible()
  // Spec 008 (clarification 2026-08-08): no Developer Tools group remains.
  await expect(box.getByRole('group', { name: 'Developer Tools' })).toHaveCount(0)
  await expect(box.getByRole('group', { name: 'Editor Theme' })).toHaveCount(0)

  // FR-004: the Theme entry is not selected while General is.
  await expect(nav.getByRole('button', { name: 'Theme' })).toHaveAttribute('aria-pressed', 'false')
})

test('US1 switching to Theme shows only the theme areas and highlights the entry', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')
  const nav = box.getByRole('navigation', { name: 'Settings areas' })

  await nav.getByRole('button', { name: 'Theme' }).click()

  // FR-003: only the Theme areas are shown; the General areas are gone.
  await expect(box.getByRole('group', { name: 'Editor Theme' })).toBeVisible()
  await expect(box.getByRole('group', { name: 'Spellcheck' })).toHaveCount(0)
  await expect(box.getByRole('group', { name: 'Opening Files' })).toHaveCount(0)

  // FR-004: the selected state moved to the Theme entry.
  await expect(nav.getByRole('button', { name: 'Theme' })).toHaveAttribute('aria-pressed', 'true')
  await expect(nav.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'false')

  // The app Theme group (spec 013) has exactly three options.
  await expect(box.getByRole('group', { name: 'Theme', exact: true })).toBeVisible()
  await expect(box.getByRole('group', { name: 'Theme', exact: true }).getByRole('radio')).toHaveCount(3)

  // The Editor Theme group (spec 016) lists exactly five options (FR-001).
  const themeGroup = box.getByRole('group', { name: 'Editor Theme' })
  await expect(themeGroup.getByRole('radio')).toHaveCount(5)
  await expect(themeGroup.getByRole('radio', { name: 'Rustic', exact: true })).toBeVisible()
  await expect(themeGroup.getByRole('radio', { name: 'Scholarly', exact: true })).toBeVisible()
})

test('US1 the General area has pill switches for spellcheck and the file preference', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')

  // FR-006: the booleans are checkboxes rendered as switches (native, so role
  // checkbox; the visual pill is a styling concern).
  const spellcheck = box.getByRole('checkbox', { name: 'Check spelling while typing' })
  const filePreference = box.getByRole('checkbox', { name: 'Open explorer files in a new tab' })
  await expect(spellcheck).toBeChecked()
  await expect(filePreference).not.toBeChecked()

  // Spec 008 (clarification 2026-08-08): no developer-tools control remains.
  await expect(box.getByRole('checkbox', { name: 'Enable developer tools' })).toHaveCount(0)

  // The file preference switch alone conveys its state (helper removed).
  await clickSwitch(box, 'Open explorer files in a new tab')
  await expect(filePreference).toBeChecked()
})

test('US1 General settings persist immediately and survive a restart', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')

  await clickSwitch(box, 'Open explorer files in a new tab')
  // Immediate persistence — no Save required for General (spec 008 apply model).
  await expect.poll(() => persistedSetting<string>('fileOpenBehavior')).toBe('new-tab')

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()
  const reopened = await openSettingsDialog(window)
  await expect(reopened.getByTestId('settings-dialog').getByRole('checkbox', { name: 'Open explorer files in a new tab' })).toBeChecked()
})

test('US1 S2/S3 selecting a theme and pressing Save applies it and persists it', async () => {
  await openFile()
  // Default canvas is Rustic (warm off-white #fdf6e3).
  await expect.poll(canvasBackground).toBe('rgb(253, 246, 227)')

  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await dialog.getByRole('radio', { name: 'Scholarly', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // The canvas re-renders in Scholarly immediately (FR-003).
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'scholarly')
  await expect.poll(canvasBackground).toBe('rgb(255, 255, 255)')

  // The choice is persisted to the shared config.json (FR-004/FR-005).
  await expect.poll(() => persistedSetting<string>('editorTheme')).toBe('scholarly')
})

test('US1 S4 closing without Save leaves the theme at the last committed value', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await dialog.getByRole('radio', { name: 'Monotone', exact: true }).check()
  // Close with the X — the staged selection is discarded.
  await dialog.getByRole('button', { name: 'Close settings' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'rustic')
  await expect.poll(() => persistedSetting<string>('editorTheme')).toBe('rustic')
})

test('US2/FR-005 reopening the dialog shows General and the committed theme selected', async () => {
  await openFile()
  let dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await dialog.getByRole('radio', { name: 'Rustic Serif', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')
  // FR-005: every mount starts on General.
  await expect(box.getByRole('navigation', { name: 'Settings areas' }).getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
  await expect(box.getByRole('group', { name: 'Editor Theme' })).toHaveCount(0)

  // The committed theme is shown once the Theme area is open (FR-007).
  await openThemeArea(dialog)
  await expect(dialog.getByRole('radio', { name: 'Rustic Serif', exact: true })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: 'Rustic', exact: true })).not.toBeChecked()
})

test('US2 the theme choice survives a restart', async () => {
  await openFile()
  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await dialog.getByRole('radio', { name: 'Monotone Serif', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => persistedSetting<string>('editorTheme')).toBe('monotone-serif')

  await closeAppSafely(app)

  // Restart with the same config; the dialog shows the saved theme.
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()
  const reopened = await openSettingsDialog(window)
  await openThemeArea(reopened)
  await expect(reopened.getByRole('radio', { name: 'Monotone Serif', exact: true })).toBeChecked()
})

test('US4 the dialog never discards or alters the open document', async () => {
  await openFile()
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.type(' EXTRA')

  const alphaTab = window.getByRole('tab', { name: /alpha\.md/ })
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()

  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await dialog.getByRole('radio', { name: 'Scholarly', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // The typed text and the dirty marker are unchanged (FR-008/FR-014).
  await expect(window.locator('.ProseMirror:visible')).toContainText('EXTRA')
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()
})

test('FR-007 the dialog is keyboard-accessible (open, navigate, close)', async () => {
  await openFile()

  // Open via keyboard: focus the hamburger, Enter, Tab until Settings… is the
  // focused menuitem, then Enter to open the dialog.
  const trigger = window.getByRole('button', { name: 'Open menu' })
  await trigger.focus()
  await window.keyboard.press('Enter')
  await expect(window.getByRole('menu', { name: 'Application menu' })).toBeVisible()
  for (let i = 0; i < 12; i++) {
    const focusedLabel = await window.evaluate(
      () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? ''
    )
    if (focusedLabel === 'Settings…') break
    await window.keyboard.press('Tab')
  }
  const focused = await window.evaluate(
    () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? ''
  )
  expect(focused).toBe('Settings…')
  await window.keyboard.press('Enter')
  await expect(window.getByTestId('settings-dialog')).toBeVisible()

  // Arrow keys within the Editor Theme group change the staged selection (the
  // canvas does NOT change until Save).
  const dialog = window.getByTestId('settings-dialog')
  const nav = dialog.getByRole('navigation', { name: 'Settings areas' })
  await nav.getByRole('button', { name: 'Theme' }).focus()
  await window.keyboard.press('Enter')
  await expect(dialog.getByRole('group', { name: 'Editor Theme' })).toBeVisible()
  const themeGroup = dialog.getByRole('group', { name: 'Editor Theme' })
  await themeGroup.getByRole('radio', { name: 'Rustic', exact: true }).focus()
  await window.keyboard.press('ArrowDown')
  await expect(themeGroup.getByRole('radio', { name: 'Rustic Serif', exact: true })).toBeChecked()
  // Staged only — the canvas is still the default Rustic.
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'rustic')

  // Escape closes the dialog without committing the staged selection.
  await window.keyboard.press('Escape')
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'rustic')
})

test('FR-007 the focus trap covers the sidebar, switches, and footer buttons', async () => {
  await openFile()
  await openSettingsDialog(window)
  const dialog = window.getByTestId('settings-dialog')
  const box = dialog

  // Seat focus on the active area's first navigation button (the dialog does
  // this on open; the shared open helper refocuses the hamburger trigger, so
  // re-seat it deterministically here before cycling).
  await dialog.getByRole('button', { name: 'General', exact: true }).focus()
  await expect.poll(focusedElement).toBe('button:General')

  // Tab cycles through the enabled controls inside the dialog: nav buttons,
  // the spellcheck select, the switch inputs, and the footer buttons. The
  // focus must never escape the dialog.
  let seenSwitch = false
  let seenSelect = false
  for (let i = 0; i < 20; i++) {
    await window.keyboard.press('Tab')
    const active = await focusedElement()
    expect(active).not.toBe('')
    const inDialog = await box.evaluate((el) => el.contains(document.activeElement))
    expect(inDialog).toBe(true)
    if (active.startsWith('input[name=spellcheck]') || active.startsWith('input[name=file-open-behavior]') || active.startsWith('input[name=developer-tools]')) seenSwitch = true
    if (active.startsWith('select')) seenSelect = true
  }
  // The spellcheck language select and at least one switch were reachable.
  expect(seenSwitch).toBe(true)
  expect(seenSelect).toBe(true)
})

test('FR-006 a missing config opens with Rustic default and a change writes a valid config', async () => {
  // No config.json exists yet (fresh MM_CONFIG_DIR).
  await openFile()
  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await expect(dialog.getByRole('radio', { name: 'Rustic', exact: true })).toBeChecked()

  await dialog.getByRole('radio', { name: 'Rustic Serif', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => persistedSetting<string>('editorTheme')).toBe('rustic-serif')
  // The written config is valid JSON and still carries recentItems.
  const configPath = path.join(configDir, 'config.json')
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  expect(parsed.settings.editorTheme).toBe('rustic-serif')
  expect(parsed.recentItems).toBeDefined()
})

test('FR-006 a malformed config still opens the dialog with Rustic default', async () => {
  const configPath = path.join(configDir, 'config.json')
  fs.writeFileSync(configPath, '{ not json', 'utf-8')

  // Deliberately do NOT open a file/folder first: a folder open records a
  // recent item, whose read-modify-write repairs the malformed file before the
  // dialog reads it (review #27 #4 — the old test was vacuous). Opening the
  // dialog directly exercises the true malformed-config tolerance path.
  const dialog = await openSettingsDialog(window)
  await openThemeArea(dialog)
  await expect(dialog.getByRole('radio', { name: 'Rustic', exact: true })).toBeChecked()
  const contents = fs.readFileSync(configPath, 'utf-8')
  expect(contents === '{ not json' || JSON.parse(contents).windowState !== undefined).toBe(true)
})

test('edge case: at a very narrow width the sidebar and panel stay usable without overlap', async () => {
  await openFile()
  // Narrow the window below the responsive breakpoint (480px).
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setBounds({ width: 380, height: 600 })
  })

  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')

  // The dialog fits within the viewport.
  const boxRect = await box.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, width: r.width }
  })
  expect(boxRect.left).toBeGreaterThanOrEqual(0)
  expect(boxRect.right).toBeLessThanOrEqual(380)

  // The sidebar and the main panel are both usable (non-zero size) and do not
  // overlap each other.
  const sidebarRect = await box.locator('.settings-sidebar').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, width: r.width }
  })
  const mainRect = await box.locator('.settings-main').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, width: r.width }
  })
  expect(sidebarRect.width).toBeGreaterThan(0)
  expect(mainRect.width).toBeGreaterThan(0)
  // On narrow widths the sidebar stacks above the panel — no overlap.
  expect(sidebarRect.bottom).toBeLessThanOrEqual(mainRect.top)

  // Both area entries remain reachable after the resize.
  await box.getByRole('button', { name: 'Theme', exact: true }).click()
  await expect(box.getByRole('group', { name: 'Editor Theme' })).toBeVisible()
})
