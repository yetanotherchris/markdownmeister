import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openFolder } from './launch'

/**
 * Spec 058: creating a new file in the explorer opens it in a new active tab
 * the moment its name is confirmed (FR-001), empty and clean (FR-002).
 * Cancellation and failed naming open nothing (FR-004); folders never open a
 * tab (FR-006); a creation whose path is already open focuses the existing tab
 * (FR-003); a dirty active tab keeps its unsaved changes (FR-007); the
 * untitled-document flow is unchanged (FR-008).
 */

let app: ElectronApplication
let window: Page
let testFolder: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-new-file-tab-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello alpha.')
  fs.writeFileSync(path.join(testFolder, 'beta.md'), '# Beta')
  fs.mkdirSync(path.join(testFolder, 'sub'))
  fs.writeFileSync(path.join(testFolder, 'sub', 'gamma.md'), '# Gamma')
  fs.mkdirSync(path.join(testFolder, 'notes'))
  fs.writeFileSync(path.join(testFolder, 'notes', 'note.md'), '# Note')
})

async function resetFixture(): Promise<void> {
  for (const f of ['alpha.md', 'beta.md', 'sub/gamma.md', 'notes/note.md']) {
    const p = path.join(testFolder, f)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(
      p,
      f === 'alpha.md'
        ? '# Alpha\n\nHello alpha.'
        : f === 'beta.md'
          ? '# Beta'
          : f === 'sub/gamma.md'
            ? '# Gamma'
            : '# Note'
    )
  }
  // Remove anything a previous test created.
  for (const name of [
    'new-file-1.md',
    'new-folder-1',
    'sub/fresh.md',
    'sub/ok.md',
    'notes/extra.md',
    'notes/docs'
  ]) {
    const p = path.join(testFolder, name)
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
  }
}

test.beforeEach(async () => {
  await resetFixture()
  ;({ app, window } = await launchApp(undefined, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

/** Create a new file or folder inside `folderName` and confirm its name. */
async function createEntryIn(
  folderName: string,
  action: 'New File' | 'New Folder',
  name: string
): Promise<void> {
  const row = window.getByRole('treeitem').filter({ hasText: folderName })
  await row.click({ button: 'right' })
  await window.getByRole('menuitem').getByText(action).click()
  const input = window.getByRole('textbox', { name: /Name new/ })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
}

test('US1/FR-001+002 a confirmed file creation opens an empty clean tab in the right folder', async () => {
  await openFolder(window)

  await createEntryIn('sub', 'New File', 'fresh.md')

  // The created file opens in a new active tab (FR-001), empty and clean
  // (FR-002), and is the file from the subfolder, not the placeholder.
  const tab = window.getByRole('tab', { name: /fresh\.md/ })
  await expect(tab).toBeVisible()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(window.locator('.document-title')).toContainText('fresh.md')
  await expect(window.locator('.document-title')).not.toContainText('\u2022')
  await expect(window.locator('.ProseMirror:visible')).toHaveText('')
  await expect(window.getByRole('treeitem').getByText('fresh.md')).toBeVisible()
  expect(fs.existsSync(path.join(testFolder, 'sub', 'fresh.md'))).toBe(true)
})

test('US3/FR-007 a dirty active tab keeps its unsaved changes across a creation', async () => {
  await openFolder(window)
  await window.getByRole('treeitem').getByText('alpha.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type(' dirty edit')

  await createEntryIn('notes', 'New File', 'extra.md')

  // The new file is active; the dirty tab is still present with its marker.
  await expect(window.getByRole('tab', { name: /extra\.md/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  const dirtyTab = window.getByRole('tab', { name: /alpha\.md/ })
  await expect(dirtyTab).toBeVisible()
  await expect(dirtyTab.getByLabel('unsaved changes')).toBeVisible()

  // Switching back recovers the unsaved edits intact.
  await dirtyTab.click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('dirty edit')
  await expect(window.locator('.document-title')).toContainText('\u2022')
})

test('US2/FR-004 cancelling the naming input opens nothing and leaves no placeholder', async () => {
  await openFolder(window)
  const row = window.getByRole('treeitem').filter({ hasText: 'sub' })
  await row.click({ button: 'right' })
  await window.getByRole('menuitem').getByText('New File').click()
  const input = window.getByRole('textbox', { name: /Name new/ })
  await expect(input).toBeVisible()
  await input.press('Escape')

  await expect(window.getByRole('tab')).toHaveCount(0)
  await expect(window.getByRole('treeitem').getByText(/new-file-/)).toHaveCount(0)
  const placeholders = fs.readdirSync(path.join(testFolder, 'sub'))
  expect(placeholders.filter((p) => p.startsWith('new-file-'))).toHaveLength(0)
})

test('US2/FR-004 a rejected name opens nothing; the accepted retry opens the tab', async () => {
  await openFolder(window)
  const row = window.getByRole('treeitem').filter({ hasText: 'sub' })
  await row.click({ button: 'right' })
  await window.getByRole('menuitem').getByText('New File').click()
  const input = window.getByRole('textbox', { name: /Name new/ })
  await expect(input).toBeVisible()

  // Non-markdown name is rejected: no tab opens, the placeholder stays put.
  await input.fill('bad.txt')
  await input.press('Enter')
  await expect(window.getByRole('tab')).toHaveCount(0)
  await expect(window.getByRole('treeitem').getByText('new-file-1.md')).toBeVisible()

  // The still-pending placeholder can be renamed to a valid name, and that
  // accepted creation opens the tab.
  await window.getByRole('treeitem').getByText('new-file-1.md').click({ button: 'right' })
  await window.getByRole('menuitem').getByText('Rename').click()
  const retryInput = window.getByRole('textbox', { name: /Name new/ })
  await expect(retryInput).toBeVisible()
  await retryInput.fill('ok.md')
  await retryInput.press('Enter')

  await expect(window.getByRole('tab', { name: /ok\.md/ })).toHaveAttribute('aria-selected', 'true')
  expect(fs.existsSync(path.join(testFolder, 'sub', 'ok.md'))).toBe(true)
})

test('US3/FR-006 creating a folder opens no tab', async () => {
  await openFolder(window)

  await createEntryIn('sub', 'New Folder', 'docs')

  await expect(window.getByRole('tab')).toHaveCount(0)
  await expect(window.getByRole('treeitem').getByText('docs')).toBeVisible()
  expect(fs.existsSync(path.join(testFolder, 'sub', 'docs'))).toBe(true)
})

test('US3/FR-003 a creation whose path is already open focuses the existing tab, no duplicate', async () => {
  await openFolder(window)
  await window
    .getByRole('treeitem')
    .filter({ hasText: 'sub' })
    .getByRole('button', { name: 'Expand' })
    .click()
  await expect(window.getByRole('treeitem').getByText('gamma.md')).toBeVisible()
  await window.getByRole('treeitem').getByText('gamma.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()

  // Remove the file on disk while its tab stays open, so a new creation of the
  // same name succeeds and its path collides with the open tab.
  fs.rmSync(path.join(testFolder, 'sub', 'gamma.md'))

  await createEntryIn('sub', 'New File', 'gamma.md')

  // The existing tab is focused; no duplicate tab is opened.
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tab', { name: /gamma\.md/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(fs.existsSync(path.join(testFolder, 'sub', 'gamma.md'))).toBe(true)
})

test('FR-008 the untitled-document flow is unchanged', async () => {
  await openFolder(window)
  await window.getByRole('button', { name: 'New file' }).click()

  // The tab-bar action still opens an untitled document, never a file.
  await expect(window.getByRole('tab', { name: /Untitled-\d/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /\.md/ })).toHaveCount(0)
})
