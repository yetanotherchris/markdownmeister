import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openFolder, electronLaunchArgs, messageBoxCallCount } from './launch'

/**
 * Spec 006 suite (contracts/os-open.md): OS-initiated opens, the Windows
 * Explorer verb argv and the macOS Finder `open-file` event both arrive in main
 * as a path, open a file or folder through the existing flows, never bypassing
 * the unsaved-work protections. Failures fail closed with a quiet footer note.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string
let userDataDir: string

const ELECTRON_BINARY = path.join(
  path.resolve(__dirname, '..', '..'),
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32'
    ? 'electron.exe'
    : process.platform === 'darwin'
      ? 'Electron.app/Contents/MacOS/Electron'
      : 'electron'
)

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
 * to the primary's `second-instance` handler and then quits (FR-008). Launch it
 * without Playwright's CDP attachment, which races with this short-lived process.
 */
async function launchSecondary(target: string): Promise<void> {
  const second = spawn(ELECTRON_BINARY, [...electronLaunchArgs, target], {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'ignore',
    env: { ...process.env, MM_USER_DATA_DIR: userDataDir, MM_SINGLE_INSTANCE: '1' }
  })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      second.kill()
      reject(new Error('Secondary Electron instance did not exit within 10 seconds'))
    }, 10_000)
    second.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    second.once('exit', () => {
      clearTimeout(timer)
      // Linux can report a signal rather than an exit code. Each caller checks
      // that the primary processed the path before the test passes.
      resolve()
    })
  })
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
  fs.writeFileSync(path.join(testFolder, 'beta.md'), '# Beta')
  ;({ app, window } = await launchApp(configDir, testFolder, userDataDir, {
    MM_SINGLE_INSTANCE: '1'
  }))
  await openFolder(window)
  await window.getByRole('treeitem').getByText('alpha.md').click()
  await expect(window.getByRole('tab', { name: 'alpha.md' })).toBeVisible()
  await window.getByRole('treeitem').getByText('beta.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: 'beta.md' })).toHaveAttribute('aria-selected', 'true')

  await launchSecondary(path.join(testFolder, 'alpha.md'))

  // FR-007: the existing tab is activated, the tab count never grows.
  await expect(window.getByRole('tab', { name: 'alpha.md' })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 15000 }
  )
  await expect(window.getByRole('tab')).toHaveCount(2)
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
    // confirmation (stubbed to Cancel), the OS folder is never committed.
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
