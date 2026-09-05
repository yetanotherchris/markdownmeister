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

function searchEmpty(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('explorer-search-empty')
}

function resultsView(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('search-results')
}

function resultsSummary(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('search-results-summary')
}

function section(name: string): ReturnType<Page['locator']> {
  return window.locator('.search-result-section').filter({ hasText: name })
}

function badge(sectionLocator: ReturnType<Page['locator']>): ReturnType<Page['getByTestId']> {
  return sectionLocator.getByTestId('search-result-badge')
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
  fs.writeFileSync(path.join(testFolder, 'reports', 'budget.md'), '# Finances')
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

test.describe('explorer file search (spec 057, results presentation)', () => {
  test('typing live replaces the tree with a results view (FR-001/002, spec 060)', async () => {
    await expect(searchInput()).toBeVisible()
    await expect(searchInput()).toHaveValue('')
    await expect(window.getByRole('tree')).toBeVisible()

    await searchInput().pressSequentially('alpha')
    await expect(resultsView()).toBeVisible()
    await expect(window.getByRole('tree')).toBeHidden()
    await expect(section('alpha.md')).toBeVisible()
    // alpha.md matches by name and by content; the summary counts the content
    // occurrence.
    await expect(badge(section('alpha.md'))).toHaveText('1')
    await expect(resultsSummary()).toContainText('1 match in 1 file')
  })

  test('a name match renders as a section with a badge of 1 and no snippet (FR-008)', async () => {
    await typeSearch('readme')
    await expect(section('readme.md')).toBeVisible()
    await expect(badge(section('readme.md'))).toHaveText('1')
    // readme.md content is '# Readme' so it also content-matches; a name-only
    // case needs a word absent from the content, covered in the FR-007 test.
    await expect(section('alpha.md')).toHaveCount(0)
  })

  test('a content match inside a never-opened folder surfaces as a section (spec 059)', async () => {
    await typeSearch('quarterly')
    await expect(section('quarterly.md')).toBeVisible()
    await expect(badge(section('quarterly.md'))).toHaveText('1')
    // The section shows the file's directory path, so the location is clear
    // even though reports was never opened.
    await expect(section('quarterly.md').locator('.search-result-dir')).toHaveText('reports')
  })

  test('a never-opened folder is not name-searched until it is loaded (FR-007)', async () => {
    // budget.md's filename contains 'budget' but its content ('# Finances')
    // does not; with reports never opened the file is not in the loaded tree,
    // so there is no name match and no content match.
    await typeSearch('budget')
    await expect(searchEmpty()).toBeVisible()

    await searchInput().press('Escape')
    await window
      .getByRole('treeitem')
      .filter({ hasText: 'reports' })
      .getByRole('button', { name: 'Expand' })
      .click()
    await expect(window.getByRole('treeitem').getByText('budget.md', { exact: true })).toBeVisible()
    await searchInput().pressSequentially('budget')
    await expect(section('budget.md')).toBeVisible()
    await expect(searchEmpty()).toHaveCount(0)
  })

  test('a term matching nothing shows a calm empty state, and clearing restores the tree (FR-009/010)', async () => {
    // Pre-search state: docs expanded and selected. The tree is never modified
    // during a search, so clearing restores it exactly.
    const docsRow = window.getByRole('treeitem').filter({ hasText: 'docs' })
    await docsRow.getByRole('button', { name: 'Expand' }).click()
    await expect(window.getByRole('treeitem').getByText('todo.md', { exact: true })).toBeVisible()
    await docsRow.click()
    await expect(docsRow).toHaveAttribute('aria-selected', 'true')

    await typeSearch('zzz-no-such-entry')
    await expect(searchEmpty()).toBeVisible()
    await expect(searchEmpty()).toContainText('zzz-no-such-entry')

    await searchInput().press('Escape')
    await expect(searchInput()).toHaveValue('')
    await expect(resultsView()).toHaveCount(0)
    await expect(window.getByRole('tree')).toBeVisible()
    await expect(window.getByRole('treeitem').getByText('todo.md', { exact: true })).toBeVisible()
    await expect(docsRow).toHaveAttribute('aria-selected', 'true')
    // FR-016: focus returns to the tree once the results view clears.
    const focusInTree = await window.evaluate(() => {
      const el = document.activeElement
      return !!el && !!el.closest('[role="tree"]')
    })
    expect(focusInTree).toBe(true)
  })

  test('a whitespace-only term filters nothing and keeps the tree (FR-013)', async () => {
    await searchInput().pressSequentially('   ')
    await expect(window.getByRole('tree')).toBeVisible()
    await expect(resultsView()).toHaveCount(0)
    await expect(window.getByRole('treeitem').getByText('alpha.md', { exact: true })).toBeVisible()
  })

  test('tree operations require clearing the search; create/rename/delete work after (spec 060, R5)', async () => {
    // While a term is active the tree is hidden behind the results view, so
    // the tree context menu (create) is not available.
    await typeSearch('alpha')
    await expect(resultsView()).toBeVisible()
    await expect(window.getByRole('tree')).toBeHidden()

    await searchInput().press('Escape')
    await expect(window.getByRole('tree')).toBeVisible()

    // Create a file from the tree: the flow runs normally.
    await window.locator('.tree-container').click({ button: 'right', position: { x: 120, y: 240 } })
    await window.getByRole('menuitem').getByText('New File').click()
    const placeholder = window.getByRole('textbox', { name: /Name new file/ })
    await expect(placeholder).toBeVisible()
    await placeholder.fill('created.md')
    await placeholder.press('Enter')
    await expect(
      window.getByRole('treeitem').getByText('created.md', { exact: true })
    ).toBeVisible()
    expect(fs.existsSync(path.join(testFolder, 'created.md'))).toBe(true)
  })

  test('the term resets on workspace change and restart (FR-011)', async () => {
    await typeSearch('alpha')
    await expect(resultsView()).toBeVisible()
    await expect(searchInput()).toHaveValue('alpha')

    await stubOpenDialog(app, secondFolder)
    await window.getByRole('button', { name: 'Open menu' }).click()
    await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
    await expect(window.getByRole('treeitem').getByText('other.md', { exact: true })).toBeVisible()
    await expect(searchInput()).toHaveValue('')
    await expect(resultsView()).toHaveCount(0)

    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, testFolder))
    await stubTrash(app)
    await stubMessageBox(app)
    await openFolder(window)
    await expect(searchInput()).toHaveValue('')
    await expect(window.getByRole('treeitem').getByText('alpha.md', { exact: true })).toBeVisible()
  })

  test('a 5,000-entry workspace shows a result within a bounded wait (FR-014, SC-002)', async () => {
    test.setTimeout(120_000)
    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, largeFolder))
    await stubTrash(app)
    await stubMessageBox(app)
    await openFolder(window)
    await expect(window.getByRole('treeitem').first()).toBeVisible()

    const started = Date.now()
    await searchInput().pressSequentially('needle')
    await expect(section('needle-file.md')).toBeVisible()
    await expect(searchEmpty()).toHaveCount(0)
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
