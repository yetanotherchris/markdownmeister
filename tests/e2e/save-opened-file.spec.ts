import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  clickHamburgerItem,
  clickHamburgerRecent,
  closeAppSafely,
  launchApp,
  openFolder,
  openHamburger,
  pressShortcut,
  stubOpenDialog,
  typeInEditor
} from './launch'

/**
 * Spec 069: Save writes an opened file in place. The location dialog stays for
 * Save As and for a document that has never been saved.
 */

let app: ElectronApplication
let window: Page
let scratch: string
let outside: string
let configDir: string

test.beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-save-opened-'))
  fs.mkdirSync(path.join(scratch, 'folder'))
  fs.writeFileSync(path.join(scratch, 'folder', 'inside.md'), '# Inside\n\nHello inside.\n')
  outside = path.join(scratch, 'outside.md')
  fs.writeFileSync(outside, '# Outside\n\nHello outside.\n')
})

test.beforeEach(async () => {
  fs.writeFileSync(path.join(scratch, 'folder', 'inside.md'), '# Inside\n\nHello inside.\n')
  fs.writeFileSync(outside, '# Outside\n\nHello outside.\n')
  fs.rmSync(path.join(scratch, 'chosen.md'), { force: true })
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-save-opened-config-'))
  ;({ app, window } = await launchApp(configDir))
  await stubSaveDialog({ cancel: true })
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true })
})

async function stubSaveDialog(choice: { cancel: true } | { filePath: string }): Promise<void> {
  await app.evaluate(({ dialog }, payload) => {
    const state = { count: 0 }
    ;(global as { __mmSaveDialogs?: { count: number } }).__mmSaveDialogs = state
    dialog.showSaveDialog = async () => {
      state.count += 1
      const chosen = payload as { filePath?: string }
      if (chosen.filePath && state.count === 1) {
        return { canceled: false, filePath: chosen.filePath }
      }
      return { canceled: true }
    }
  }, choice)
}

async function saveDialogCount(): Promise<number> {
  return app.evaluate(() => {
    return (global as { __mmSaveDialogs?: { count: number } }).__mmSaveDialogs?.count ?? 0
  })
}

async function clickSave(): Promise<void> {
  await openHamburger(window)
  await window.getByRole('menuitem', { name: 'Save', exact: true }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
}

async function openExistingFile(file: string): Promise<void> {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath as string]
    })
  }, file)
  await clickHamburgerItem(window, 'Open File…')
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

test('Open File with no folder saves in place from the menu and the shortcut', async () => {
  const before = fs.readFileSync(outside, 'utf-8')
  await openExistingFile(outside)
  await clickSave()
  expect(fs.readFileSync(outside, 'utf-8')).toBe(before)
  expect(await saveDialogCount()).toBe(0)

  await typeInEditor(window, 'MENU ')
  await clickSave()
  await expect(window.getByRole('tab', { name: /outside\.md/ }).locator('.tab-dirty')).toHaveCount(
    0
  )
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('MENU')
  expect(await saveDialogCount()).toBe(0)

  await typeInEditor(window, 'SHORTCUT ')
  await pressShortcut(app, 's', ['control'])
  await expect(window.getByRole('tab', { name: /outside\.md/ }).locator('.tab-dirty')).toHaveCount(
    0
  )
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('SHORTCUT')
  expect(await saveDialogCount()).toBe(0)
})

test('a file inside the folder saves in place from the explorer and from Open File', async () => {
  const inside = path.join(scratch, 'folder', 'inside.md')
  await stubOpenDialog(app, path.join(scratch, 'folder'))
  await openFolder(window)
  await window.getByRole('treeitem').getByText('inside.md').click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('Hello inside.')

  await typeInEditor(window, 'TREE ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(inside, 'utf-8')).toContain('TREE')
  expect(await saveDialogCount()).toBe(0)

  await openExistingFile(inside)
  await typeInEditor(window, 'OPEN ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(inside, 'utf-8')).toContain('OPEN')
  expect(await saveDialogCount()).toBe(0)
})

test('Open File outside an open folder saves that file and leaves the folder', async () => {
  const inside = path.join(scratch, 'folder', 'inside.md')
  const insideBefore = fs.readFileSync(inside, 'utf-8')
  await stubOpenDialog(app, path.join(scratch, 'folder'))
  await openFolder(window)
  await openExistingFile(outside)

  await typeInEditor(window, 'OUTSIDE ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('OUTSIDE')
  expect(fs.readFileSync(inside, 'utf-8')).toBe(insideBefore)
  await expect(window.getByRole('treeitem').getByText('inside.md')).toBeVisible()
  expect(await saveDialogCount()).toBe(0)
})

test('a recent file saves in place', async () => {
  await openExistingFile(outside)
  await clickHamburgerItem(window, 'Close Tab')
  await expect(window.getByRole('tab', { name: /outside\.md/ })).toHaveCount(0)

  await clickHamburgerRecent(window, 'outside.md')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Hello outside.')
  await typeInEditor(window, 'RECENT ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('RECENT')
  expect(await saveDialogCount()).toBe(0)
})

test('an operating-system open saves in place', async () => {
  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, undefined, undefined, undefined, [outside]))
  await stubSaveDialog({ cancel: true })
  await expect(window.getByRole('tab', { name: /outside\.md/ })).toBeVisible()
  await expect(window.locator('.ProseMirror:visible')).toContainText('Hello outside.')

  await typeInEditor(window, 'OS ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('OS')
  expect(await saveDialogCount()).toBe(0)
})

test('a second Save writes the same opened file', async () => {
  await openExistingFile(outside)
  await typeInEditor(window, 'FIRST ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('FIRST')

  await typeInEditor(window, 'SECOND ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(outside, 'utf-8')).toContain('SECOND')
  expect(await saveDialogCount()).toBe(0)
})

test('Save of a never-saved document asks for a location and creates nothing when cancelled', async () => {
  const namesBefore = fs.readdirSync(scratch).sort()
  await clickHamburgerItem(window, 'New File')
  await expect(window.getByRole('tab', { name: /Untitled-/ })).toBeVisible()
  await typeInEditor(window, 'unsaved words')
  await clickSave()
  await expect(window.getByRole('tab', { name: /Untitled-/ }).locator('.tab-dirty')).toBeVisible()
  expect(await saveDialogCount()).toBe(1)
  expect(fs.readdirSync(scratch).sort()).toEqual(namesBefore)
})

test('direct Save of a deleted opened file does not recreate it or ask for a location', async () => {
  await openExistingFile(outside)
  await typeInEditor(window, 'GONE ')
  await expect(window.getByRole('tab', { name: /outside\.md/ }).locator('.tab-dirty')).toBeVisible()
  fs.rmSync(outside)
  await clickSave()
  expect(fs.existsSync(outside)).toBe(false)
  await expect(window.getByRole('tab', { name: /outside\.md/ }).locator('.tab-dirty')).toBeVisible()
  expect(await saveDialogCount()).toBe(0)
})

test('Save As outside the folder becomes the next save target, and cancel leaves it', async () => {
  const chosen = path.join(scratch, 'chosen.md')
  const original = fs.readFileSync(outside, 'utf-8')
  await stubSaveDialog({ filePath: chosen })
  await openExistingFile(outside)

  await clickHamburgerItem(window, 'Save As…')
  await expect.poll(() => fs.existsSync(chosen)).toBe(true)
  expect(fs.readFileSync(chosen, 'utf-8')).toContain('Hello outside.')
  expect(fs.readFileSync(outside, 'utf-8')).toBe(original)
  expect(await saveDialogCount()).toBe(1)

  await typeInEditor(window, 'CHOSEN ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(chosen, 'utf-8')).toContain('CHOSEN')
  expect(fs.readFileSync(outside, 'utf-8')).toBe(original)
  expect(await saveDialogCount()).toBe(1)

  await clickHamburgerItem(window, 'Save As…')
  expect(await saveDialogCount()).toBe(2)
  const afterCancel = fs.readFileSync(chosen, 'utf-8')
  expect(afterCancel).toContain('CHOSEN')
  expect(afterCancel).not.toContain('STILL')
  await typeInEditor(window, 'STILL ')
  await clickSave()
  await expect.poll(() => fs.readFileSync(chosen, 'utf-8')).toContain('STILL')
  expect(fs.readFileSync(outside, 'utf-8')).toBe(original)
  expect(await saveDialogCount()).toBe(2)
})
