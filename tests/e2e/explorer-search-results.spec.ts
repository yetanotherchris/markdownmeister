import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, stubTrash, stubMessageBox, openFolder } from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

function searchInput(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('explorer-search-input')
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
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-results-ws-'))
  fs.writeFileSync(
    path.join(testFolder, 'one.md'),
    'The walrus was there, and then the walrus again.\nplain line\nAnother walrus here.\n'
  )
  fs.mkdirSync(path.join(testFolder, 'notes'))
  fs.writeFileSync(path.join(testFolder, 'notes', 'two.md'), 'A single walrus sighting.\n')
  fs.writeFileSync(
    path.join(testFolder, 'notes', 'long.md'),
    `${'x'.repeat(4000)} walrus ${'y'.repeat(4000)}\n`
  )
  fs.writeFileSync(path.join(testFolder, 'walrus.md'), '# Mammal facts\n\nno name word here\n')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-search-results-config-'))
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
})

test.describe('explorer search results (spec 060)', () => {
  test('the summary line totals matches across files (FR-002)', async () => {
    await typeSearch('walrus')
    // one.md has 3 occurrences, notes/two.md has 1, notes/long.md has 1, and
    // walrus.md is a name match counted once.
    await expect(resultsSummary()).toHaveText('6 matches in 4 files')
  })

  test('file sections show icon, name, directory, chevron, and a badge (FR-003/004)', async () => {
    await typeSearch('walrus')
    const one = section('one.md')
    await expect(one).toBeVisible()
    await expect(one.locator('.search-result-icon')).toBeVisible()
    await expect(one.locator('.search-result-name')).toHaveText('one.md')
    await expect(one.locator('.search-result-chevron')).toBeVisible()
    await expect(badge(one)).toHaveText('3')
    await expect(section('two.md').locator('.search-result-dir')).toHaveText('notes')
    await expect(badge(section('two.md'))).toHaveText('1')
  })

  test('sections are expanded by default and collapsible (FR-005)', async () => {
    await typeSearch('walrus')
    const one = section('one.md')
    await expect(one.locator('.search-result-snippet')).toHaveCount(2)
    await expect(one.locator('.search-result-chevron')).toHaveAttribute('aria-expanded', 'true')

    await one.locator('.search-result-chevron').click()
    await expect(one.locator('.search-result-chevron')).toHaveAttribute('aria-expanded', 'false')
    await expect(one.locator('.search-result-snippet')).toHaveCount(0)

    await one.locator('.search-result-chevron').click()
    await expect(one.locator('.search-result-snippet')).toHaveCount(2)
  })

  test('a snippet per matching line, each occurrence highlighted (FR-006/007)', async () => {
    await typeSearch('walrus')
    const one = section('one.md')
    await expect(one.locator('.search-result-snippet')).toHaveCount(2)
    // The first snippet line contains the term twice, both highlighted.
    await expect(one.locator('.search-result-mark')).toHaveCount(3)
    await expect(one.locator('.search-result-snippet').first()).toContainText(
      'The walrus was there, and then the walrus again.'
    )
  })

  test('a long matching line is truncated with ellipses around the match (FR-006)', async () => {
    await typeSearch('walrus')
    const long = section('long.md')
    await expect(badge(long)).toHaveText('1')
    const text = await long.locator('.search-result-snippet-text').textContent()
    expect(text).toContain('walrus')
    expect(text!.startsWith('...')).toBe(true)
    expect(text!.endsWith('...')).toBe(true)
    expect(text!.length).toBeLessThan(150)
  })

  test('a file matching both by name and by content appears once (FR-008)', async () => {
    await typeSearch('walrus')
    // Wait for the content scan to settle before counting: name matches render
    // instantly, content matches arrive after the debounced scan.
    await expect(section('one.md')).toBeVisible()
    // walrus.md is a name match (badge 1, no content snippet since its content
    // does not contain 'walrus'); one.md/two.md/long.md are content matches.
    const walrus = section('walrus.md')
    await expect(walrus).toBeVisible()
    await expect(badge(walrus)).toHaveText('1')
    await expect(walrus.locator('.search-result-snippet')).toHaveCount(0)
    expect(await resultsView().locator('.search-result-section').count()).toBe(4)
  })

  test('clicking a section or snippet opens the file with duplicate-tab focus (FR-009)', async () => {
    await typeSearch('walrus')
    // Clicking the section (the open button) opens the file.
    await section('one.md').locator('.search-result-open').click()
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await expect(window.locator('.document-title')).toContainText('one.md')
    await expect(window.getByRole('tab')).toHaveCount(1)

    // Reopening from the results again focuses the existing tab.
    await section('one.md').locator('.search-result-snippet').first().click()
    await expect(window.getByRole('tab')).toHaveCount(1)

    // A second file from the same results opens with the same-tab behaviour
    // (default fileOpenBehavior), replacing the active document.
    await section('two.md').locator('.search-result-snippet').first().click()
    await expect(window.locator('.document-title')).toContainText('two.md')
    await expect(window.getByRole('tab')).toHaveCount(1)
  })

  test('the badge count matches the occurrences in the file (SC-005)', async () => {
    // one.md has 'walrus' twice on one line and once on another = 3.
    await typeSearch('walrus')
    await expect(badge(section('one.md'))).toHaveText('3')
    // notes/two.md has one occurrence on one line = 1.
    await expect(badge(section('two.md'))).toHaveText('1')
  })
})
