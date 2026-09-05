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
  openFolder,
  pressShortcut
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
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-content-search-ws-'))
  fs.mkdirSync(path.join(testFolder, 'notes'))
  fs.writeFileSync(
    path.join(testFolder, 'notes', 'journal.md'),
    'The moon phase was a waxing crescent.'
  )
  fs.mkdirSync(path.join(testFolder, 'deep', 'nest'), { recursive: true })
  fs.writeFileSync(path.join(testFolder, 'deep', 'nest', 'hidden.md'), 'snippet walrus cavalry')
  fs.writeFileSync(
    path.join(testFolder, 'plans.md'),
    '# Plans\n\nQuarterly budget review on Tuesday.'
  )
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nplain text')
  fs.writeFileSync(path.join(testFolder, 'misc.md'), 'The alpha channel drives the blend.')
  fs.writeFileSync(
    path.join(testFolder, 'secret.md'),
    ['---', 'tags: [aurora]', '---', '', '# Secret body', ''].join('\n')
  )
  fs.writeFileSync(path.join(testFolder, 'legacy.markdown'), '# Legacy\n\nbrandywine receipt')

  secondFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-content-search-ws2-'))
  fs.writeFileSync(path.join(secondFolder, 'other.md'), '# Other\n\nunrelated words')

  // SC-002: every generated file contains the needle term, so a content scan
  // walks 5,000 files.
  largeFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-content-search-large-'))
  for (let i = 0; i < 5_000; i++) {
    fs.writeFileSync(
      path.join(largeFolder, `file-${String(i).padStart(4, '0')}.md`),
      `# File ${i}\n\nThe needle term appears in every document.`
    )
  }
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-content-search-config-'))
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

test.describe('explorer content search (spec 059, results presentation)', () => {
  test('a content phrase in a never-opened folder surfaces the file with its directory (US1)', async () => {
    await typeSearch('walrus')
    await expect(section('hidden.md')).toBeVisible()
    await expect(section('hidden.md').locator('.search-result-dir')).toHaveText('deep/nest')
    await expect(badge(section('hidden.md'))).toHaveText('1')
    await expect(searchEmpty()).toHaveCount(0)
  })

  test('filename and content matches appear together; a content-only match is shown (FR-003/005)', async () => {
    await typeSearch('alpha')
    // alpha.md matches by name and by content (one occurrence); misc.md matches
    // only by content ("alpha channel").
    await expect(section('alpha.md')).toBeVisible()
    await expect(section('misc.md')).toBeVisible()
    await expect(badge(section('misc.md'))).toHaveText('1')
    await expect(section('plans.md')).toHaveCount(0)
  })

  test('a term in frontmatter counts as content (edge case)', async () => {
    await typeSearch('aurora')
    await expect(section('secret.md')).toBeVisible()
  })

  test('content search covers .markdown files too (FR-011)', async () => {
    await typeSearch('brandywine')
    await expect(section('legacy.markdown')).toBeVisible()
  })

  test('a term matching neither names nor contents keeps the empty state (FR-009)', async () => {
    await typeSearch('qzxwvzz-no-such')
    await expect(searchEmpty()).toBeVisible()
  })

  test('content search never modifies a file; editing and saving still work (FR-006, SC-004)', async () => {
    const before = fs.readFileSync(path.join(testFolder, 'deep', 'nest', 'hidden.md'))
    await typeSearch('walrus')
    await expect(section('hidden.md')).toBeVisible()
    // The on-disk bytes are untouched by the scan.
    expect(fs.readFileSync(path.join(testFolder, 'deep', 'nest', 'hidden.md')).equals(before)).toBe(
      true
    )
    // Clicking the snippet opens the original content.
    await section('hidden.md').locator('.search-result-snippet').first().click()
    await expect(window.locator('.ProseMirror:visible')).toContainText('snippet walrus cavalry')
    expect(fs.readFileSync(path.join(testFolder, 'deep', 'nest', 'hidden.md')).equals(before)).toBe(
      true
    )
    // The normal editing flow works on a content-matched file.
    await window.locator('.ProseMirror:visible').click()
    await window.keyboard.press('Control+End')
    await window.keyboard.type(' EDITED-TAIL')
    await expect(window.locator('.document-title')).toContainText('\u2022')
    await pressShortcut(app, 's', ['control'])
    await expect
      .poll(() => fs.readFileSync(path.join(testFolder, 'deep', 'nest', 'hidden.md'), 'utf-8'))
      .toContain('EDITED-TAIL')
  })

  test('clearing the term removes the results and returns the tree (FR-007/010)', async () => {
    // notes is never opened before searching.
    await typeSearch('waxing')
    await expect(section('journal.md')).toBeVisible()

    await searchInput().press('Escape')
    await expect(searchInput()).toHaveValue('')
    await expect(resultsView()).toHaveCount(0)
    await expect(window.getByRole('tree')).toBeVisible()
  })

  test('results reset on workspace change and restart (FR-008/011)', async () => {
    await typeSearch('walrus')
    await expect(section('hidden.md')).toBeVisible()

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

  test('a whitespace-only term triggers no content search (FR-013)', async () => {
    await searchInput().pressSequentially('   ')
    await expect(window.getByRole('tree')).toBeVisible()
    await expect(resultsView()).toHaveCount(0)
  })

  test('a 5,000-file workspace content-searches without perceptible lag (FR-014, SC-002)', async () => {
    test.setTimeout(120_000)
    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, largeFolder))
    await stubTrash(app)
    await stubMessageBox(app)
    await openFolder(window)
    await expect(window.getByRole('treeitem').first()).toBeVisible()

    // The first scan reads every file from disk; that cold cost is bounded
    // generously here (a slow disk can take tens of seconds on 5,000 files).
    await searchInput().pressSequentially('needle')
    await expect(section('file-0000.md')).toBeVisible({ timeout: 60_000 })
    await expect(searchEmpty()).toHaveCount(0)

    // A second search in the same session is served from the content cache
    // (only stat calls), so it must land well inside the responsive bound.
    await searchInput().press('Escape')
    await expect(searchInput()).toHaveValue('')
    const started = Date.now()
    await searchInput().pressSequentially('document')
    await expect(section('file-0000.md')).toBeVisible()
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
