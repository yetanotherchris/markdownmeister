import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  clickHamburgerItem,
  closeAppSafely,
  launchApp,
  messageBoxCallCount,
  stubOpenDialog,
  typeInEditor
} from './launch'

/**
 * Spec 073 US1: a file opened before its containing folder is one tab, not
 * two. Opening the folder and then the file, by explorer or by Open File,
 * activates the tab that already holds the unsaved text.
 */

let app: ElectronApplication
let window: Page
let scratch: string
let dir: string
let dirA: string
let configDir: string
let userDataDir: string

test.beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-one-tab-'))
  dir = path.join(scratch, 'dir')
  const dir2 = path.join(scratch, 'dir2')
  fs.mkdirSync(dir)
  fs.mkdirSync(path.join(dir, 'sub'))
  fs.mkdirSync(dir2)
  fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\nAlpha original.')
  fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\nBeta original.')
  fs.writeFileSync(path.join(dir2, 'a.md'), '# A2\n\nOther alpha.')
  dirA = path.join(dir, 'a.md')
})

test.beforeEach(async () => {
  fs.writeFileSync(dirA, '# A\n\nAlpha original.')
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-one-tab-config-'))
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-one-tab-user-'))
  ;({ app, window } = await launchApp(configDir, undefined, userDataDir))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
  fs.rmSync(userDataDir, { recursive: true, force: true })
})

test.afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true })
})

async function openFileViaDialog(filePath: string): Promise<void> {
  await stubOpenDialog(app, filePath)
  await clickHamburgerItem(window, 'Open File…')
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

async function openFolderViaDialog(folder: string): Promise<void> {
  await stubOpenDialog(app, folder)
  await clickHamburgerItem(window, 'Open Folder…')
  await expect(window.getByRole('treeitem').getByText('a.md')).toBeVisible()
}

async function expectSingleActiveTabWithText(text: string): Promise<void> {
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tab', { name: /a\.md/ })).toHaveAttribute('aria-selected', 'true')
  await expect(window.locator('.ProseMirror:visible')).toContainText(text)
  expect(await messageBoxCallCount(app)).toBe(0)
}

test('F1: the explorer reuses the tab opened before its folder', async () => {
  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'FIRST ')

  await openFolderViaDialog(dir)
  await window.getByRole('treeitem').getByText('a.md').click()

  await expectSingleActiveTabWithText('FIRST')
})

test('S3: Open File after the folder is open reuses the earlier tab', async () => {
  await openFileViaDialog(dirA)
  await typeInEditor(window, 'FIRST ')
  await openFolderViaDialog(dir)

  await openFileViaDialog(dirA)

  await expectSingleActiveTabWithText('FIRST')
})
