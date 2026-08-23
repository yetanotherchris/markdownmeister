import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
// The electron-free policy module (research R3) is importable anywhere; the
// suites share its constant instead of re-declaring the URL independently.
import { REPOSITORY_URL } from '../../src/main/buildInfo'
import { closeAppSafely, launchApp, messageBoxCallCount, openSettingsDialog } from './launch'

/**
 * Spec 037 suite: the About settings area. Covers the acceptance scenarios —
 * the nav entry last (FR-001), three read-only values with the true version
 * (FR-002), the exact-URL external hand-off recorded in main (FR-004), the
 * full-value clipboard round-trip (FR-006), the never-prompting stateless
 * close (FR-008), and the development placeholder forced through the
 * unpackaged MM_BUILD_COMMIT seam (FR-007, research R4).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-about-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-about-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openAboutArea(): Promise<void> {
  const dialog = await openSettingsDialog(window)
  await dialog
    .getByTestId('settings-dialog')
    .getByRole('navigation', { name: 'Settings areas' })
    .getByRole('button', { name: 'About' })
    .click()
  await expect(dialog.getByRole('group', { name: 'About' })).toBeVisible()
}

/** Stub shell.openExternal in main and record every call's URL. */
async function stubOpenExternal(target: ElectronApplication): Promise<void> {
  await target.evaluate(({ shell }) => {
    const g = globalThis as unknown as { __aboutOpenExternal: string[] }
    g.__aboutOpenExternal = []
    shell.openExternal = async (url: string) => {
      g.__aboutOpenExternal.push(url)
    }
  })
}

async function openExternalCalls(target: ElectronApplication): Promise<string[]> {
  return target.evaluate(() => {
    const g = globalThis as unknown as { __aboutOpenExternal?: string[] }
    return g.__aboutOpenExternal ?? []
  })
}

async function clipboardText(target: ElectronApplication): Promise<string> {
  return target.evaluate(({ clipboard }) => clipboard.readText())
}

test('US1 the navigation ends with About and it shows only the three read-only values', async () => {
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')
  const nav = box.getByRole('navigation', { name: 'Settings areas' })

  // FR-001 + placement assumption: About is listed last, after Markdown, and
  // is not selected while General holds the initial selection.
  const entries = await nav.getByRole('button').allTextContents()
  expect(entries.map((label) => label.trim())).toEqual(['General', 'Theme', 'Markdown', 'About'])
  await expect(nav.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
  await expect(nav.getByRole('button', { name: 'About' })).toHaveAttribute('aria-pressed', 'false')

  await nav.getByRole('button', { name: 'About' }).click()
  await expect(box.getByRole('group', { name: 'About' })).toBeVisible()

  // FR-008: purely read-only information — no adjustable control renders.
  expect(await box.locator('.settings-main input, .settings-main select').count()).toBe(0)
})

test('US1/FR-002 the displayed version equals the running application version', async () => {
  await openAboutArea()

  const runtimeVersion = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
  await expect(window.getByTestId('settings-about-version')).toHaveText(runtimeVersion)
})

test('US1 the repository URL and a full revision identifier are both shown', async () => {
  await openAboutArea()

  await expect(window.getByTestId('settings-about-repository')).toHaveText(REPOSITORY_URL)
  // The built app embeds the source revision; it must be a full hash, not the
  // placeholder and not an abbreviation (FR-005, Assumptions: full identifier).
  const revision = await window.getByTestId('settings-about-revision').textContent()
  expect(revision).toMatch(/^[0-9a-f]{40}$/)
})

test('US2/FR-004 activating the repository URL hands the exact URL to the OS exactly once', async () => {
  await stubOpenExternal(app)
  await openAboutArea()

  await window.getByTestId('settings-about-repository').click()

  // FR-004: exactly one external hand-off carrying the constant URL, and zero
  // in-application side effects — the dialog stays put.
  await expect.poll(() => openExternalCalls(app)).toEqual([REPOSITORY_URL])
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
})

test('US2/FR-006 copying the revision yields the complete displayed value', async () => {
  await openAboutArea()

  const displayed = await window.getByTestId('settings-about-revision').textContent()
  await window.getByTestId('settings-about-copy').click()

  // The renderer write is asynchronous; poll main's clipboard until it lands.
  await expect.poll(() => clipboardText(app)).toBe(displayed)
})

test('FR-008 viewing About and closing the dialog never prompts about unsaved changes', async () => {
  await openAboutArea()
  await window.getByRole('button', { name: 'Close settings' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // No native box was raised merely by viewing and closing the area.
  expect(await messageBoxCallCount(app)).toBe(0)

  // Quitting straight after must also go through unattended: the shared stub
  // answers every native box with its safe "cancel" choice, so if ANY quit
  // confirmation appeared the close would be prevented and this wait would
  // time out. Its success therefore proves the quit was prompt-free.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].close()
  })
  await app.waitForEvent('close', { timeout: 8000 })
})

test('FR-007 an unpackaged run forced into development mode shows the honest placeholder', async () => {
  await closeAppSafely(app)

  // research R4: MM_BUILD_COMMIT is honoured only in unpackaged runs, so the
  // built app can be driven to the no-metadata path without touching packaged
  // behaviour. Empty string maps to null → the literal placeholder renders.
  ;({ app, window } = await launchApp(configDir, testFolder, undefined, {
    MM_BUILD_COMMIT: ''
  }))
  await openAboutArea()

  await expect(window.getByTestId('settings-about-revision')).toHaveText('development build')
  await expect(window.getByTestId('settings-about-copy')).toHaveCount(0)
  await expect(window.getByTestId('settings-about-repository')).toHaveText(REPOSITORY_URL)
})
