import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely } from './launch'

/**
 * Spec 029 suite (contracts/file-open-gesture.md), 2026-08-21 amendment: every
 * open commits immediately, the deferral window is gone. With "Open explorer
 * files in a new tab" disabled, a double-click's first click replaces a clean
 * active tab and its explicit-new second request dedupes onto that tab, so one
 * tab results (amended FR-001/003); over a dirty active tab the first click
 * still opens a NEW tab and the dirty tab stays untouched (FR-002/009);
 * already-open files activate their existing tab (FR-005); single-click is
 * immediate (FR-007); no-tab double-click opens one tab (FR-008). With the
 * setting enabled a double-click matches a single click (FR-004). Directories
 * expand/collapse on double-click and never open a tab (FR-006).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-dbl-click-ws-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello alpha.')
  fs.writeFileSync(path.join(testFolder, 'beta.md'), '# Beta\n\nHello beta.')
  fs.writeFileSync(path.join(testFolder, 'gamma.md'), '# Gamma\n\nHello gamma.')
  fs.mkdirSync(path.join(testFolder, 'docs'))
  fs.writeFileSync(path.join(testFolder, 'docs', 'nested.md'), '# Nested\n\nHello nested.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-dbl-click-config-'))
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

/** Single-click a file in the tree (follows the preference; commits immediately). */
async function openFromTree(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

/** Double-click a tree entry by name. */
async function doubleClickTree(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).dblclick()
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

// ---------- US1: same-tab users pin a file to its own tab ----------

test('US1/FR-001 amended a double-click over a clean active tab replaces it (second request dedupes)', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)

  // First click replaces the clean active tab; the double-click's explicit-new
  // request then finds the file already open and activates that same tab.
  await doubleClickTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('beta.md')
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toHaveCount(0)
})

test('US1/FR-009 a double-click leaves a dirty active tab untouched', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type(' dirty edit')
  await expect(window.locator('.document-title')).toContainText('\u2022')

  await doubleClickTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
  // The dirty tab keeps its dirty marker.
  await window.getByRole('tab', { name: /alpha\.md/ }).click()
  await expect(window.locator('.document-title')).toContainText('\u2022')
})

test('US1/FR-008 a double-click with no tab open opens a single new tab', async () => {
  await openWorkspaceFolder()

  await doubleClickTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
})

test('US1 a double-click replaces a clean untitled tab (first click wins)', async () => {
  await openWorkspaceFolder()
  await window.getByRole('button', { name: 'New file' }).click()
  await expect(window.getByRole('tab', { name: /Untitled-\d/ })).toBeVisible()

  // The first click replaces the clean untitled tab; the double-click's
  // explicit-new request dedupes onto the opened tab.
  await doubleClickTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
})

test('US1/FR-005 a double-click on an already-open file activates its tab, no duplicate', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  // Open beta in a NEW tab (middle-click) so both tabs exist.
  await window.getByRole('treeitem').getByText('beta.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(2)

  // Double-click alpha: its existing tab is activated, beta stays, no new tab.
  await doubleClickTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
})

test('US1/FR-007 a single click still replaces a clean active tab (no new tab)', async () => {
  await openWorkspaceFolder()
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)

  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.locator('.document-title')).toContainText('beta.md')
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toHaveCount(0)
})

// ---------- US2: new-tab users see no change ----------

test('US2/FR-004 with the setting enabled a double-click opens one new tab (no duplicate)', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(true)
  await openFromTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(1)

  await doubleClickTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
  await expect(window.getByRole('tab', { name: /alpha\.md/ })).toBeVisible()
})

test('US2/FR-005 with the setting enabled a double-click on an open file activates it', async () => {
  await openWorkspaceFolder()
  await setExplorerPreference(true)
  await openFromTree('alpha.md')
  await openFromTree('beta.md')
  await expect(window.getByRole('tab')).toHaveCount(2)

  await doubleClickTree('alpha.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.locator('.document-title')).toContainText('alpha.md')
  await expect(window.getByRole('tab', { name: /beta\.md/ })).toBeVisible()
})

// ---------- US3: directories keep their current behaviour ----------

test('US3/FR-006 a double-click expands a collapsed directory without opening a tab', async () => {
  await openWorkspaceFolder()
  const dir = window.getByRole('treeitem').filter({ hasText: 'docs' })
  await expect(dir).toHaveAttribute('aria-expanded', 'false')

  await doubleClickTree('docs')
  await expect(dir).toHaveAttribute('aria-expanded', 'true')
  await expect(window.getByRole('treeitem').getByText('nested.md')).toBeVisible()
  await expect(window.getByRole('tab')).toHaveCount(0)
})

test('US3/FR-006 a double-click collapses an expanded directory without opening a tab', async () => {
  await openWorkspaceFolder()
  const dir = window.getByRole('treeitem').filter({ hasText: 'docs' })

  await doubleClickTree('docs')
  await expect(dir).toHaveAttribute('aria-expanded', 'true')

  await doubleClickTree('docs')
  await expect(dir).toHaveAttribute('aria-expanded', 'false')
  await expect(window.getByRole('tab')).toHaveCount(0)
})
