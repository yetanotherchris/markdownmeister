import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  clickHamburgerItem,
  closeAppSafely,
  launchApp,
  messageBoxCallCount,
  openHamburger,
  stubOpenDialog,
  typeInEditor
} from './launch'

/**
 * Spec 073 US1: a file opened before its containing folder is one tab, not
 * two. Opening the folder and then the file, by explorer or by Open File,
 * activates the tab that already holds the unsaved text. US2 covers the
 * remaining routes and the Save As identity lifecycle. US3 covers a
 * case-variant path, gated on a filesystem probe rather than the platform.
 */

let app: ElectronApplication
let window: Page
let scratch: string
let dir: string
let dir2: string
let dirA: string
let dir2A: string
let configDir: string
let userDataDir: string
let caseInsensitiveFs: boolean
let symlinkSupported: boolean

test.beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-one-tab-'))
  dir = path.join(scratch, 'dir')
  dir2 = path.join(scratch, 'dir2')
  fs.mkdirSync(dir)
  fs.mkdirSync(path.join(dir, 'sub'))
  fs.mkdirSync(dir2)
  fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\nAlpha original.')
  fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\nBeta original.')
  fs.writeFileSync(path.join(dir2, 'a.md'), '# A2\n\nOther alpha.')
  dirA = path.join(dir, 'a.md')
  dir2A = path.join(dir2, 'a.md')

  // Probe the filesystem once: a differently cased spelling of a file that was
  // just created exists only when names are compared without case.
  const probe = path.join(scratch, 'case-probe.md')
  fs.writeFileSync(probe, '# Probe')
  caseInsensitiveFs = fs.existsSync(path.join(scratch, 'CASE-PROBE.md'))
  fs.rmSync(probe)

  // Probe once: file symlinks need Developer Mode or elevation on Windows. A
  // permission error means the scenario cannot run; any other error is real.
  const symlinkTarget = path.join(scratch, 'symlink-probe.md')
  const symlinkProbe = path.join(scratch, 'symlink-probe-link.md')
  fs.writeFileSync(symlinkTarget, '# Probe')
  try {
    fs.symlinkSync(symlinkTarget, symlinkProbe, 'file')
    symlinkSupported = true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'EPERM' && code !== 'EACCES') throw error
    symlinkSupported = false
  } finally {
    fs.rmSync(symlinkProbe, { force: true })
    fs.rmSync(symlinkTarget, { force: true })
  }
})

test.beforeEach(async () => {
  fs.writeFileSync(dirA, '# A\n\nAlpha original.')
  fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\nBeta original.')
  fs.writeFileSync(dir2A, '# A2\n\nOther alpha.')
  fs.rmSync(path.join(scratch, 'a.md'), { force: true })
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

/** Open a folder whose root has no markdown file, waiting for a child entry. */
async function openFolderAtRoot(folder: string, childName: string): Promise<void> {
  await stubOpenDialog(app, folder)
  await clickHamburgerItem(window, 'Open Folder…')
  await expect(window.getByRole('treeitem').getByText(childName, { exact: true })).toBeVisible()
}

async function expectSingleActiveTabWithText(text: string): Promise<void> {
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tab', { name: /a\.md/ })).toHaveAttribute('aria-selected', 'true')
  await expect(window.locator('.ProseMirror:visible')).toContainText(text)
  expect(await messageBoxCallCount(app)).toBe(0)
}

async function typeIntoVisibleEditor(text: string): Promise<void> {
  await window.locator('[contenteditable="true"]:visible').first().click()
  await window.keyboard.type(text)
}

async function clickSave(): Promise<void> {
  await openHamburger(window)
  await window.getByRole('menuitem', { name: 'Save', exact: true }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
}

async function stubSaveDialog(filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, chosenPath) => {
    const state = { count: 0 }
    ;(global as { __mmSaveDialogs?: { count: number } }).__mmSaveDialogs = state
    dialog.showSaveDialog = async () => {
      state.count += 1
      if (state.count === 1) return { canceled: false, filePath: chosenPath as string }
      return { canceled: true }
    }
  }, filePath)
}

async function saveDialogCount(): Promise<number> {
  return app.evaluate(() => {
    return (global as { __mmSaveDialogs?: { count: number } }).__mmSaveDialogs?.count ?? 0
  })
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

test('H12: Open File after the explorer reuses the tab', async () => {
  await openFolderViaDialog(dir)
  await window.getByRole('treeitem').getByText('a.md').click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'EXPLORER ')

  await openFileViaDialog(dirA)

  await expectSingleActiveTabWithText('EXPLORER')
})

test('symlink to an open file reuses the tab', async () => {
  test.skip(!symlinkSupported, 'symlink creation needs privileges (Developer Mode on Windows)')

  const link = path.join(dir, 'link.md')
  fs.rmSync(link, { force: true })
  fs.symlinkSync(dirA, link, 'file')

  try {
    await openFileViaDialog(dirA)
    await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
    await typeInEditor(window, 'SYMLINK ')

    await openFileViaDialog(link)

    await expectSingleActiveTabWithText('SYMLINK')
  } finally {
    fs.rmSync(link, { force: true })
  }
})

test('parent-segment spelling reuses the tab', async () => {
  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'PARENT ')

  await openFileViaDialog(`${dir}${path.sep}sub${path.sep}..${path.sep}a.md`)

  await expectSingleActiveTabWithText('PARENT')
})

test('H13: the explorer after Open File reuses the earlier tab', async () => {
  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'MENU ')

  await openFolderViaDialog(dir)
  await window.getByRole('treeitem').getByText('a.md').click()

  await expectSingleActiveTabWithText('MENU')
})

test('rebinds a tab to the current root after a folder change', async () => {
  await openFolderViaDialog(dir)
  await window.getByRole('treeitem').getByText('a.md').click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')

  // The tab still holds `path: "a.md"` from the old root. Reopening the file
  // as `dir/a.md` under the parent root must retarget the tab's save route.
  await openFolderAtRoot(scratch, 'dir')
  await openFileViaDialog(dirA)

  await typeIntoVisibleEditor('ROOT ')
  await clickSave()

  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect.poll(() => fs.readFileSync(dirA, 'utf-8')).toContain('ROOT')
  expect(fs.existsSync(path.join(scratch, 'a.md'))).toBe(false)
  expect(await messageBoxCallCount(app)).toBe(0)
})

test('H8: the same relative path in different folders keeps two tabs and two files', async () => {
  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'DIR1 ')

  await openFileViaDialog(dir2A)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Other alpha.')
  await typeIntoVisibleEditor('DIR2 ')

  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.ProseMirror:visible')).toContainText('DIR2')
  await clickSave()
  await expect.poll(() => fs.readFileSync(dir2A, 'utf-8')).toContain('DIR2')
  await expect.poll(() => fs.readFileSync(dirA, 'utf-8')).not.toContain('DIR2')

  await window.getByRole('tab').nth(0).click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('DIR1')
  await clickSave()
  await expect.poll(() => fs.readFileSync(dirA, 'utf-8')).toContain('DIR1')
  await expect.poll(() => fs.readFileSync(dir2A, 'utf-8')).not.toContain('DIR1')
  expect(await messageBoxCallCount(app)).toBe(0)
})

test('Save As retargets the tab identity and the old file opens separately', async () => {
  const dirB = path.join(dir, 'b.md')
  await stubSaveDialog(dirB)

  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'SAVED ')
  await clickHamburgerItem(window, 'Save As…')

  await expect.poll(() => fs.readFileSync(dirB, 'utf-8')).toContain('SAVED')
  expect(fs.readFileSync(dirA, 'utf-8')).not.toContain('SAVED')
  expect(await saveDialogCount()).toBe(1)
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tab', { name: /b\.md/ })).toHaveAttribute('aria-selected', 'true')

  await openFileViaDialog(dirB)
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tab', { name: /b\.md/ })).toHaveAttribute('aria-selected', 'true')
  await expect(window.locator('.ProseMirror:visible')).toContainText('SAVED')

  await typeIntoVisibleEditor('AGAIN ')
  await expect(window.getByRole('tab', { name: /b\.md/ }).locator('.tab-dirty')).toBeVisible()
  await expect(window.getByRole('tab')).toHaveCount(1)

  await openFileViaDialog(dirA)
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /a\.md/ })).toHaveAttribute('aria-selected', 'true')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeIntoVisibleEditor('ORIGINAL ')
  await clickSave()

  await expect.poll(() => fs.readFileSync(dirA, 'utf-8')).toContain('ORIGINAL')
  await expect.poll(() => fs.readFileSync(dirA, 'utf-8')).not.toContain('SAVED')
  expect(fs.readFileSync(dirB, 'utf-8')).not.toContain('ORIGINAL')
  expect(fs.readFileSync(dirB, 'utf-8')).toContain('SAVED')
  expect(await saveDialogCount()).toBe(1)
  expect(await messageBoxCallCount(app)).toBe(0)
})

test('F3: a case-variant path reuses the tab on a case-insensitive filesystem', async () => {
  test.skip(!caseInsensitiveFs, 'filesystem distinguishes letter case; see the F3 control')

  await openFileViaDialog(dirA)
  await expect(window.locator('.ProseMirror:visible')).toContainText('Alpha original.')
  await typeInEditor(window, 'LOWER ')

  await openFileViaDialog(path.join(dir, 'A.md'))

  await expectSingleActiveTabWithText('LOWER')
})

test('F3 control: case-variant names stay separate on a case-sensitive filesystem', async () => {
  test.skip(caseInsensitiveFs, 'filesystem ignores letter case; see the F3 match scenario')

  const caseDir = path.join(scratch, 'caseDir')
  fs.mkdirSync(caseDir, { recursive: true })
  const lowerCase = path.join(caseDir, 'case.md')
  const upperCase = path.join(caseDir, 'CASE.md')
  fs.writeFileSync(lowerCase, '# case\n\nlower original.')
  fs.writeFileSync(upperCase, '# CASE\n\nupper original.')

  await openFileViaDialog(lowerCase)
  await expect(window.locator('.ProseMirror:visible')).toContainText('lower original.')
  await typeInEditor(window, 'LOWER ')

  await openFileViaDialog(upperCase)
  await expect(window.locator('.ProseMirror:visible')).toContainText('upper original.')
  await typeIntoVisibleEditor('UPPER ')

  await expect(window.getByRole('tab')).toHaveCount(2)
  await clickSave()
  await expect.poll(() => fs.readFileSync(upperCase, 'utf-8')).toContain('UPPER')
  await expect.poll(() => fs.readFileSync(lowerCase, 'utf-8')).not.toContain('UPPER')

  await window.getByRole('tab').nth(0).click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('LOWER')
  await clickSave()
  await expect.poll(() => fs.readFileSync(lowerCase, 'utf-8')).toContain('LOWER')
  await expect.poll(() => fs.readFileSync(upperCase, 'utf-8')).not.toContain('LOWER')
  expect(await messageBoxCallCount(app)).toBe(0)
})
