import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openFolder, electronLaunchArgs, messageBoxCallCount } from './launch'

/**
 * Spec 006 suite (contracts/os-open.md): OS-initiated opens — the Windows
 * Explorer verb argv and the macOS Finder `open-file` event both arrive in main
 * as a path — open a file or folder through the existing flows, never bypassing
 * the unsaved-work protections. Failures fail closed with a quiet footer note.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string
let userDataDir: string

test.beforeEach(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-osopen-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
  fs.writeFileSync(path.join(testFolder, 'notes.txt'), 'not markdown')
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-osopen-cfg-'))
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-osopen-ud-'))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(testFolder, { recursive: true, force: true })
  fs.rmSync(configDir, { recursive: true, force: true })
  fs.rmSync(userDataDir, { recursive: true, force: true })
})

/**
 * Launch a secondary instance with the SAME private user-data dir so the
 * single-instance lock is held by the primary; the secondary forwards its argv
 * to the primary's `second-instance` handler and then quits (FR-008). It quits
 * so fast Playwright may or may not attach — either way the argv is delivered.
 */
async function launchSecondary(target: string): Promise<void> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  env.MM_USER_DATA_DIR = userDataDir
  env.MM_SINGLE_INSTANCE = '1'
  try {
    const second = await electron.launch({ args: [...electronLaunchArgs, target], env })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await second.close().catch(() => {})
  } catch {
    /* the secondary exited before Playwright attached — argv already forwarded */
  }
}

test('US1 an OS file open on first launch opens the file as a document', async () => {
  ;({ app, window } = await launchApp(configDir, undefined, undefined, undefined, [
    path.join(testFolder, 'alpha.md')
  ]))

  await expect(window.getByRole('tab', { name: 'alpha.md' })).toBeVisible()
  await expect(window.locator('.ProseMirror:visible')).toContainText('Hello world.')
  await expect(window.getByTestId('footer-workspace')).toContainText('No folder open')
})

test('US2 an OS folder open on first launch opens it as the workspace', async () => {
  ;({ app, window } = await launchApp(configDir, undefined, undefined, undefined, [testFolder]))

  await expect(window.getByRole('treeitem').getByText('alpha.md')).toBeVisible()
  await expect(window.getByTestId('footer-workspace')).toContainText(path.basename(testFolder))
})

test('US1/FR-008 an OS open while running is received by the primary instance', async () => {
  ;({ app, window } = await launchApp(configDir, testFolder, userDataDir, {
    MM_SINGLE_INSTANCE: '1'
  }))
  await openFolder(window)

  await launchSecondary(path.join(testFolder, 'alpha.md'))

  // FR-008: the running instance processes the forwarded path instead of
  // starting a duplicate session.
  await expect(window.getByRole('tab', { name: 'alpha.md' })).toBeVisible({ timeout: 15000 })
  await expect(window.getByRole('tab')).toHaveCount(1)
})

test('US1/FR-007 an already-open file OS-open activates its existing tab (no duplicate)', async () => {
  ;({ app, window } = await launchApp(configDir, testFolder, userDataDir, {
    MM_SINGLE_INSTANCE: '1'
  }))
  await openFolder(window)
  await window.getByRole('treeitem').getByText('alpha.md').click()
  await expect(window.getByRole('tab', { name: 'alpha.md' })).toBeVisible()

  await launchSecondary(path.join(testFolder, 'alpha.md'))

  // FR-007: the existing tab is activated — the tab count never grows.
  await expect(window.getByRole('tab', { name: 'alpha.md' })).toBeVisible({ timeout: 15000 })
  await expect(window.getByRole('tab')).toHaveCount(1)
})

test('US2/FR-009 a folder OS-open preserves the unsaved-work confirmation', async () => {
  ;({ app, window } = await launchApp(configDir, testFolder, userDataDir, {
    MM_SINGLE_INSTANCE: '1'
  }))
  await openFolder(window)
  await window.getByRole('treeitem').getByText('alpha.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type('unsaved edit')

  const otherFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-osopen-other-'))
  fs.writeFileSync(path.join(otherFolder, 'beta.md'), '# Beta')
  try {
    await launchSecondary(otherFolder)

    // FR-009: the dirty workspace-relative document triggers the folder-open
    // confirmation (stubbed to Cancel) — the OS folder is never committed.
    await expect.poll(async () => messageBoxCallCount(app)).toBeGreaterThanOrEqual(1)
    await expect(window.getByTestId('footer-workspace')).toContainText(
      path.basename(testFolder)
    )
    await expect(window.getByTestId('footer-workspace')).not.toContainText(
      path.basename(otherFolder)
    )
    // The dirty document survives, still dirty, in the unchanged workspace.
    await expect(window.getByTestId('footer-document')).toContainText('alpha.md')
    await expect(window.locator('.document-title .footer-dirty')).toBeVisible()
  } finally {
    fs.rmSync(otherFolder, { recursive: true, force: true })
  }
})

test('FR-011 a missing OS path fails closed with a quiet footer note', async () => {
  ;({ app, window } = await launchApp(configDir, undefined, undefined, undefined, [
    path.join(testFolder, 'gone.md')
  ]))

  await expect(window.getByTestId('footer-note')).toBeVisible()
  await expect(window.getByRole('tab')).toHaveCount(0)
  await expect(window.getByTestId('footer-document')).toContainText('No document open')
})

test('FR-011 an unsupported extension is refused and the session is unchanged', async () => {
  ;({ app, window } = await launchApp(configDir, undefined, undefined, undefined, [
    path.join(testFolder, 'notes.txt')
  ]))

  await expect(window.getByTestId('footer-note')).toBeVisible()
  await expect(window.getByRole('tab')).toHaveCount(0)
  await expect(window.getByTestId('footer-document')).toContainText('No document open')
})
