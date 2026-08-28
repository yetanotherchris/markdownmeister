import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { REPOSITORY_URL } from '../../src/main/buildInfo'
import { closeAppSafely, launchApp, messageBoxCallCount, openSettingsDialog } from './launch'

/**
 * Spec 037 suite, pared down by spec 050: the About settings area. Covers the
 * nav entry last (FR-001), the bare version value with no label (spec 050
 * FR-001), the unchanged repository row and its exact-URL external hand-off
 * (FR-002/FR-004), zero revision content regardless of build metadata (spec
 * 050 FR-003), and the never-prompting stateless close (FR-008).
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

test('US1 the navigation ends with About and it shows only read-only values', async () => {
  const dialog = await openSettingsDialog(window)
  const box = dialog.getByTestId('settings-dialog')
  const nav = box.getByRole('navigation', { name: 'Settings areas' })

  // About starts unselected after the other settings areas.
  const entries = await nav.getByRole('button').allTextContents()
  expect(entries.map((label) => label.trim())).toEqual(['General', 'Theme', 'Markdown', 'About'])
  await expect(nav.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
  await expect(nav.getByRole('button', { name: 'About' })).toHaveAttribute('aria-pressed', 'false')

  await nav.getByRole('button', { name: 'About' }).click()
  await expect(box.getByRole('group', { name: 'About' })).toBeVisible()

  // FR-008: purely read-only information, no adjustable control renders.
  expect(await box.locator('.settings-main input, .settings-main select').count()).toBe(0)
})

test('US1/FR-002 the displayed version equals the running application version', async () => {
  await openAboutArea()

  const runtimeVersion = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
  await expect(window.getByTestId('settings-about-version')).toHaveText(runtimeVersion)
})

test('spec 050 FR-001 the version renders as a bare value with no Version label', async () => {
  await openAboutArea()

  // Two rows remain: the bare version and the labelled repository row.
  const rows = window.locator('.settings-about-row')
  await expect(rows).toHaveCount(2)
  const labels = await rows.locator('.settings-about-label').allTextContents()
  expect(labels.map((label) => label.trim())).toEqual(['Repository URL'])
  const panel = window.getByRole('group', { name: 'About' })
  await expect(panel).not.toContainText('Version', { ignoreCase: true })
})

test('spec 050 FR-003 no revision identifier, label, or copy control appears', async () => {
  await openAboutArea()

  const panel = window.getByRole('group', { name: 'About' })
  await expect(panel).not.toContainText('Revision')
  await expect(panel).not.toContainText('Copy')
  await expect(panel).not.toContainText('development build')
  await expect(window.getByTestId('settings-about-revision')).toHaveCount(0)
  await expect(window.getByTestId('settings-about-copy')).toHaveCount(0)
  await expect(window.getByTestId('settings-about-repository')).toHaveText(REPOSITORY_URL)
})

test('US2/FR-004 activating the repository URL hands the exact URL to the OS exactly once', async () => {
  await stubOpenExternal(app)
  await openAboutArea()

  await window.getByTestId('settings-about-repository').click()

  // FR-004: exactly one external hand-off carrying the constant URL, and zero
  // in-application side effects, the dialog stays put.
  await expect.poll(() => openExternalCalls(app)).toEqual([REPOSITORY_URL])
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
})

test('US2/FR-004 repeated activation hands off exactly once per click with no duplicated state', async () => {
  await stubOpenExternal(app)
  await openAboutArea()

  const link = window.getByTestId('settings-about-repository')
  await link.click()
  await link.click()

  // Each click sends one URL without changing the dialog.
  await expect.poll(() => openExternalCalls(app)).toEqual([REPOSITORY_URL, REPOSITORY_URL])
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await expect(window.getByTestId('settings-about-repository')).toHaveText(REPOSITORY_URL)
})

test('FR-008 viewing About and closing the dialog never prompts about unsaved changes', async () => {
  await openAboutArea()
  await window.getByRole('button', { name: 'Close settings' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // No native box was raised merely by viewing and closing the area.
  expect(await messageBoxCallCount(app)).toBe(0)

  // The dialog stub cancels prompts, so a prompt would prevent the close.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].close()
  })
  await app.waitForEvent('close', { timeout: 8000 })
})

test('spec 050 FR-003 a development run without revision metadata still shows version and repository', async () => {
  await closeAppSafely(app)

  // An empty override exercises the unpackaged development path.
  ;({ app, window } = await launchApp(configDir, testFolder, undefined, {
    MM_BUILD_COMMIT: ''
  }))
  await openAboutArea()

  const runtimeVersion = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
  await expect(window.getByTestId('settings-about-version')).toHaveText(runtimeVersion)
  await expect(window.getByTestId('settings-about-repository')).toHaveText(REPOSITORY_URL)
  const panel = window.getByRole('group', { name: 'About' })
  await expect(panel).not.toContainText('Revision')
  await expect(window.getByTestId('settings-about-revision')).toHaveCount(0)
})

test('spec 050 FR-003 an odd revision override never surfaces anywhere in the panel', async () => {
  await closeAppSafely(app)

  ;({ app, window } = await launchApp(configDir, testFolder, undefined, {
    MM_BUILD_COMMIT: 'v1.2.3-rc.1+odd'
  }))
  await openAboutArea()

  const panel = window.getByRole('group', { name: 'About' })
  await expect(panel).not.toContainText('v1.2.3-rc.1+odd')
  await expect(window.getByTestId('settings-about-revision')).toHaveCount(0)
})
