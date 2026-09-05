import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  launchApp,
  closeAppSafely,
  stubTrash,
  stubMessageBox,
  stubOpenDialog,
  openFolder
} from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let secondFolder: string
let largeFolder: string
let configDir: string

function searchInput(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('explorer-search-input')
}

function searchClear(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('explorer-search-clear')
}

function searchEmpty(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('explorer-search-empty')
}

/** The tree row whose name is exactly `name` (rows carry the entry name). */
function treeRow(name: string): ReturnType<Page['locator']> {
  return window.getByRole('treeitem').getByText(name, { exact: true })
}

/** The treeitem row whose own name is `name`. */
function row(name: string): ReturnType<Page['locator']> {
  return window.getByRole('treeitem').filter({ hasText: name })
}

async function typeSearch(text: string): Promise<void> {
  await searchInput().click()
  await searchInput().pressSequentially(text)
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-search-ws-'))
  fs.mkdirSync(path.join(testFolder, 'reports'))
  fs.writeFileSync(path.join(testFolder, 'reports', 'quarterly.md'), '# Quarterly')
  fs.writeFileSync(path.join(testFolder, 'reports', 'summary.md'), '# Summary')
  fs.mkdirSync(path.join(testFolder, 'docs'))
  fs.writeFileSync(path.join(testFolder, 'docs', 'meeting-notes.md'), '# Meeting notes')
  fs.writeFileSync(path.join(testFolder, 'docs', 'todo.md'), '# Todo')
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha')
  fs.writeFileSync(path.join(testFolder, 'beta.md'), '# Beta')
  fs.writeFileSync(path.join(testFolder, 'readme.md'), '# Readme')

  secondFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-search-ws2-'))
  fs.writeFileSync(path.join(secondFolder, 'other.md'), '# Other')
  fs.mkdirSync(path.join(secondFolder, 'deep'))
  fs.writeFileSync(path.join(secondFolder, 'deep', 'inside.md'), '# Inside')

  // SC-002: 5,000 top-level entries so filtering has a large tree to walk.
  largeFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-search-large-'))
  fs.writeFileSync(path.join(largeFolder, 'needle-file.md'), '# Needle')
  for (let i = 0; i < 5_000; i++) {
    fs.writeFileSync(path.join(largeFolder, `file-${String(i).padStart(4, '0')}.md`), `# File ${i}`)
  }
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-search-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
  await stubTrash(app)
  await stubMessageBox(app)
  await openFolder(window)
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
  fs.rmSync(secondFolder, { recursive: true, force: true })
  fs.rmSync(largeFolder, { recursive: true, force: true })
})

test.describe('explorer file search (spec 057)', () => {
  test('a search box sits above the tree and filters live per keystroke (US1, FR-001/002)', async () => {
    await expect(searchInput()).toBeVisible()
    await expect(searchInput()).toHaveValue('')

    // US1-1: the tree narrows with each keystroke, no submit step.
    await searchInput().pressSequentially('al')
    await expect(treeRow('alpha.md')).toBeVisible()
    await expect(treeRow('beta.md')).toHaveCount(0)
    await expect(treeRow('reports')).toHaveCount(0)

    await searchInput().pressSequentially('pha')
    await expect(searchInput()).toHaveValue('alpha')
    await expect(treeRow('alpha.md')).toBeVisible()
    await expect(treeRow('beta.md')).toHaveCount(0)
    await expect(treeRow('readme.md')).toHaveCount(0)
    await expect(treeRow('docs')).toHaveCount(0)
  })

  test('matches inside collapsed folders become visible with their ancestors (FR-004)', async () => {
    // Load docs once, then collapse it. FR-007 scopes search to entries
    // already listed in the tree, so a never-opened folder's children are not
    // known; a collapsed-but-loaded folder's matches must surface.
    await row('docs').getByRole('button', { name: 'Expand' }).click()
    await expect(treeRow('todo.md')).toBeVisible()
    await row('docs').getByRole('button', { name: 'Collapse' }).click()
    await expect(treeRow('todo.md')).toHaveCount(0)

    await typeSearch('meeting')
    await expect(treeRow('meeting-notes.md')).toBeVisible()
    // The ancestor folder is kept so the structure stays readable.
    await expect(treeRow('docs')).toBeVisible()
    // Non-matching entries are hidden (FR-005), matching folders with no
    // matching children are hidden too.
    await expect(treeRow('quarterly.md')).toHaveCount(0)
    await expect(treeRow('reports')).toHaveCount(0)
    await expect(treeRow('alpha.md')).toHaveCount(0)
  })

  test('a folder whose own name matches shows the folder only (FR-006)', async () => {
    await typeSearch('reports')
    await expect(treeRow('reports')).toBeVisible()
    await expect(treeRow('quarterly.md')).toHaveCount(0)
    await expect(treeRow('summary.md')).toHaveCount(0)
  })

  test('a term matching nothing shows a calm empty state, no error (FR-009)', async () => {
    await typeSearch('zzz-no-such-entry')
    await expect(searchEmpty()).toBeVisible()
    await expect(searchEmpty()).toContainText('zzz-no-such-entry')
    // The empty state replaces the tree list.
    await expect(treeRow('alpha.md')).toHaveCount(0)
    await expect(window.locator('.context-menu')).toHaveCount(0)
  })

  test('activating a match opens exactly like unfiltered, including duplicate-tab focus (US3, FR-010)', async () => {
    await typeSearch('alpha')
    await treeRow('alpha.md').click()
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await expect(window.locator('.document-title')).toContainText('alpha.md')
    await expect(window.getByRole('tab')).toHaveCount(1)

    // Reopening an already-open file from the filtered tree focuses its tab
    // instead of opening a second one, exactly as unfiltered activation does.
    await treeRow('alpha.md').click()
    await expect(window.getByRole('tab')).toHaveCount(1)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  })

  test('clearing restores expansion and selection exactly, and Escape refocuses the tree (US2/FR-008, FR-014)', async () => {
    // Pre-filter state: docs expanded and selected, reports collapsed.
    await row('docs').getByRole('button', { name: 'Expand' }).click()
    await expect(treeRow('todo.md')).toBeVisible()
    await row('docs').click()
    await expect(row('docs')).toHaveAttribute('aria-selected', 'true')

    // Filter, then click the matching reports folder while filtered: this
    // changes both expansion (library) and selection (our snapshot concern).
    await typeSearch('reports')
    await expect(treeRow('reports')).toBeVisible()
    await row('reports').click()
    await expect(row('reports')).toHaveAttribute('aria-selected', 'true')

    // Escape clears the term, restores the pre-filter state, and returns
    // focus to the tree.
    await searchInput().press('Escape')
    await expect(searchInput()).toHaveValue('')
    await expect(treeRow('todo.md')).toBeVisible()
    await expect(row('docs')).toHaveAttribute('aria-selected', 'true')
    await expect(treeRow('quarterly.md')).toHaveCount(0)
    await expect(row('reports')).toHaveAttribute('aria-selected', 'false')
    // FR-014: focus is back inside the tree (react-arborist lands it on the
    // focused row rather than the role="tree" container itself).
    const focusInTree = await window.evaluate(() => {
      const el = document.activeElement
      return !!el && !!el.closest('[role="tree"]')
    })
    expect(focusInTree).toBe(true)
  })

  test('the clear control and backspace-deleting the term both restore the tree (US2-1/2)', async () => {
    await row('docs').getByRole('button', { name: 'Expand' }).click()
    await row('docs').click()

    // Backspace the term to empty: selection and expansion survive.
    await searchInput().pressSequentially('alpha')
    await expect(treeRow('alpha.md')).toBeVisible()
    await searchInput().press('Backspace')
    await searchInput().press('Backspace')
    await searchInput().press('Backspace')
    await searchInput().press('Backspace')
    await searchInput().press('Backspace')
    await expect(searchInput()).toHaveValue('')
    await expect(treeRow('todo.md')).toBeVisible()
    await expect(row('docs')).toHaveAttribute('aria-selected', 'true')

    // The clear control removes the term and returns the tree as well.
    await searchInput().pressSequentially('beta')
    await expect(treeRow('beta.md')).toBeVisible()
    await searchClear().click()
    await expect(searchInput()).toHaveValue('')
    await expect(treeRow('todo.md')).toBeVisible()
    await expect(row('docs')).toHaveAttribute('aria-selected', 'true')
  })

  test('a whitespace-only term filters nothing (edge case)', async () => {
    await searchInput().pressSequentially('   ')
    await expect(treeRow('alpha.md')).toBeVisible()
    await expect(treeRow('beta.md')).toBeVisible()
    await expect(treeRow('reports')).toBeVisible()
    await expect(searchEmpty()).toHaveCount(0)
  })

  test('create, rename, and delete flows work while filtered (US3-3)', async () => {
    // Create a new file while "alpha" is active: the file is created on disk
    // but hidden by the filter until the term is cleared.
    await typeSearch('alpha')
    await window.locator('.tree-container').click({ button: 'right', position: { x: 120, y: 240 } })
    await window.getByRole('menuitem').getByText('New File').click()
    await expect.poll(() => fs.existsSync(path.join(testFolder, 'new-file-1.md'))).toBe(true)
    await expect(treeRow('new-file-1.md')).toHaveCount(0)

    await searchInput().press('Escape')
    const placeholder = window.getByRole('textbox', { name: /Name new file/ })
    await expect(placeholder).toBeVisible()
    await placeholder.fill('created.md')
    await placeholder.press('Enter')
    await expect(treeRow('created.md')).toBeVisible()
    expect(fs.existsSync(path.join(testFolder, 'created.md'))).toBe(true)

    // Rename a match while filtered: the new name no longer matches, so the
    // row hides; clearing the term shows the renamed entry.
    await typeSearch('created')
    await expect(treeRow('created.md')).toBeVisible()
    await treeRow('created.md').click({ button: 'right' })
    await window.getByRole('menuitem').getByText('Rename').click()
    const rename = window.getByRole('textbox', { name: /Rename/ })
    await rename.fill('renamed.md')
    await rename.press('Enter')
    await expect(treeRow('renamed.md')).toHaveCount(0)
    expect(fs.existsSync(path.join(testFolder, 'renamed.md'))).toBe(true)
    await searchInput().press('Escape')
    await expect(treeRow('renamed.md')).toBeVisible()
    await expect(treeRow('created.md')).toHaveCount(0)

    // Delete while filtered: the confirmed delete removes the entry and the
    // file, exactly as it does unfiltered.
    await typeSearch('renamed')
    await expect(treeRow('renamed.md')).toBeVisible()
    await treeRow('renamed.md').click({ button: 'right' })
    await stubMessageBox(app, 'Delete')
    await window.getByRole('menuitem').getByText('Delete').click()
    await expect(treeRow('renamed.md')).toHaveCount(0)
    expect(fs.existsSync(path.join(testFolder, 'renamed.md'))).toBe(false)
  })

  test('the term resets on workspace change and restart (US2-4, FR-013)', async () => {
    await typeSearch('alpha')
    await expect(searchInput()).toHaveValue('alpha')

    // Open a different workspace through the stubbed native folder picker.
    await stubOpenDialog(app, secondFolder)
    await window.getByRole('button', { name: 'Open menu' }).click()
    await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
    await expect(treeRow('other.md')).toBeVisible()
    await expect(searchInput()).toHaveValue('')
    await expect(treeRow('alpha.md')).toHaveCount(0)

    // A restart starts with an empty search box too (nothing is persisted).
    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, testFolder))
    await stubTrash(app)
    await stubMessageBox(app)
    await openFolder(window)
    await expect(searchInput()).toHaveValue('')
    await expect(treeRow('alpha.md')).toBeVisible()
  })

  test('a 5,000-entry workspace filters without perceptible lag (FR-012, SC-002)', async () => {
    // Re-launch against the large workspace so the tree lists all entries.
    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, largeFolder))
    await stubTrash(app)
    await stubMessageBox(app)
    await openFolder(window)
    // The 5,000th entry is off-screen until filtered (the list is virtualized).
    await expect(window.getByRole('treeitem').first()).toBeVisible()

    const started = Date.now()
    await searchInput().pressSequentially('needle')
    await expect(treeRow('needle-file.md')).toBeVisible()
    await expect(treeRow('file-0000.md')).toHaveCount(0)
    await expect(searchEmpty()).toHaveCount(0)
    // Bounded so a regression to a full-tree O(n²) per keystroke fails loudly.
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
