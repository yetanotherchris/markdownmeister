import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely } from './launch'

/**
 * Spec 024 suite (contracts/open-mode.md): opening a file from the explorer
 * replaces a clean active tab (FR-001), opens a new tab when the active tab is
 * dirty (FR-002) or there is no tab (FR-004), reactivates an existing tab
 * (FR-003), replaces a clean untitled tab (FR-009), and middle-click always
 * opens a new tab (FR-005).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-open-tab-ws-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello alpha.')
  fs.writeFileSync(path.join(testFolder, 'beta.md'), '# Beta\n\nHello beta.')
  fs.writeFileSync(path.join(testFolder, 'gamma.md'), '# Gamma\n\nHello gamma.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-open-tab-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openWorkspaceFolder(): Promise<void> {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await expect(window.getByRole('treeitem').getByText('alpha.md')).toBeVisible()
}

async function openFromTree(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

/** Set the General-area explorer file-opening preference through the dialog. */
async function setExplorerPreference(newTab: boolean): Promise<void> {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Settings…' }).click()
  const dialog = window.getByTestId('settings-dialog')
  await dialog.waitFor()
  const checkbox = dialog.getByRole('checkbox', { name: 'Open files in a new tab' })
  if ((await checkbox.isChecked()) !== newTab) {
    await dialog.locator('.settings-switch', { hasText: 'Open files in a new tab' }).click()
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
}

test('US1/FR-001 a clean active tab is replaced (no new tab)', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('alpha.md')

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('beta.md')
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toHaveCount(0)
})

test('spec 032 keeps the outgoing editor visible until the staged replacement commits', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  const outgoingEditor = window.locator('.ProseMirror:visible')
  await expect(outgoingEditor).toContainText('Hello alpha.')

  await window.getByRole('treeitem').getByText('beta.md').click()
  // Crepe initialization is asynchronous. Until its ready callback commits the
  // staged document, the old title and its non-empty editor remain on screen.
  await expect(window.locator('.document-title')).toContainText('alpha.md')
  await expect(outgoingEditor).toBeVisible()
  await expect(outgoingEditor).toContainText('Hello alpha.')

  await expect(window.locator('.document-title')).toContainText('beta.md')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Hello beta.')
})

test('US1/FR-002 a dirty active tab opens a new tab and stays open', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type(' dirty edit')
  await expect(window.locator('.document-title')).toContainText('\u2022')

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
  // The dirty tab keeps its dirty marker.
  await window.getByRole('tab', { name: /alpha\.md/ }).click()
  await expect(window.locator('.document-title')).toContainText('\u2022')
})

test('US1/FR-009 a clean untitled tab is replaced', async () => {
  await openWorkspaceFolder()
  await window.getByRole('button', { name: 'New file' }).click()
  await expect(window.getByRole('tab', { name: /Untitled-\d/ })).toBeVisible()

  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
})

test('FR-003 an already-open file activates its existing tab (no replacement)', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  // Open beta in a NEW tab (middle-click) so both tabs exist.
  await window.getByRole('treeitem').getByText('beta.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.document-title')).toContainText('beta.md')

  // Re-open alpha: its existing tab is activated, beta stays, no new tab.
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
})

test('US2 with multiple tabs, only the clean active tab is replaced', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await window.getByRole('treeitem').getByText('beta.md').click({ button: 'middle' })
  await window.getByRole('treeitem').getByText('gamma.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(3)
  await expect(window.locator('.document-title')).toContainText('gamma.md')

  // Re-open alpha: activates its existing tab (no replacement).
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(3)
  await expect(window.locator('.document-title')).toContainText('alpha.md')

  // Open a brand-new file while a clean tab is active → replaces it.
  fs.writeFileSync(path.join(testFolder, 'delta.md'), '# Delta\n\nHello delta.')
  await window.getByRole('treeitem').getByText('delta.md').click()
  await expect(window.getByRole('tab')).toHaveCount(3)
  await expect(window.locator('.document-title')).toContainText('delta.md')
})

test('US3/FR-005 middle-click always opens a new tab', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md') // clean active tab
  await expect(window.getByRole('tab')).toHaveCount(1)

  await window.getByRole('treeitem').getByText('beta.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
  // The clean tab's content is unchanged.
  await window.getByRole('tab', { name: /alpha\.md/ }).click()
  await expect(window.locator('.document-title')).toContainText('alpha.md')
})

// ---------- Spec 008 US2: the explorer file-opening preference ----------

test('FR-008 new-tab preference opens a new tab even when the active tab is clean', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(true)
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('alpha.md')

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
})

test('FR-008 new-tab preference activates an already-open file tab without a duplicate', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(true)
  await openFromTree('alpha.md')
  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)

  // Re-open alpha: its existing tab is activated, no new tab, no replacement.
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
})

test('FR-008 new-tab preference keeps a dirty tab untouched and opens the new file', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(true)
  await openFromTree('alpha.md')
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type(' dirty edit')
  await expect(window.locator('.document-title')).toContainText('\u2022')

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
  // The dirty tab keeps its dirty marker.
  await window.getByRole('tab', { name: /alpha\.md/ }).click()
  await expect(window.locator('.document-title')).toContainText('\u2022')
})

test('FR-008 same-tab preference replaces a clean active tab (no new tab)', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(false)
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('beta.md')
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toHaveCount(0)
})
