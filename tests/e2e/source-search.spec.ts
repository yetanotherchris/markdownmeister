import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  launchApp,
  closeAppSafely,
  stubTrash,
  stubMessageBox,
  openFolder,
  pressShortcut
} from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const FILLER_SENTENCE = 'The quick brown fox jumps over the lazy dog near the river bank.'

/** ~10,000 source lines: 5,000 one-line paragraphs with blank lines between,
 *  every 100th paragraph containing the search word. */
function buildHugeDoc(): string {
  const lines: string[] = []
  for (let i = 1; i <= 5_000; i++) {
    lines.push(
      i % 100 === 0
        ? `${FILLER_SENTENCE} Zebra sighting number ${i}.`
        : `${FILLER_SENTENCE} Plain paragraph ${i}.`
    )
    lines.push('')
  }
  return lines.join('\n')
}

/** Long enough that the first match sits far below the initial viewport. */
function buildCaretDoc(): string {
  const lines: string[] = ['# Caret document', '']
  for (let i = 1; i <= 900; i++) {
    lines.push(i % 100 === 0 ? `Marker line ${i}.` : `Plain line ${i} of the caret document.`)
    lines.push('')
  }
  return lines.join('\n')
}

function searchFixture(): string {
  return [
    '---',
    'title: needle hunt',
    'tags: notes',
    '---',
    '',
    '# Needle in the body',
    '',
    'The needle appears here too.',
    '',
    'And needle once more by the sea.',
    ''
  ].join('\n')
}

function wrapFixture(): string {
  return [
    '# Wrap check',
    '',
    'This very long line contains needle in the middle and keeps going so that word wrap genuinely engages in a narrow editor before the needle appears again near its end.',
    '',
    'Short line with needle.',
    ''
  ].join('\n')
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-source-search-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'fixture.md'), searchFixture())
  fs.writeFileSync(path.join(testFolder, 'caret.md'), buildCaretDoc())
  fs.writeFileSync(path.join(testFolder, 'huge.md'), buildHugeDoc())
  fs.writeFileSync(path.join(testFolder, 'wrap.md'), wrapFixture())
  fs.writeFileSync(path.join(testFolder, 'plain.md'), '# Plain\n\nNothing to find.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-source-search-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
  await stubTrash(app)
  await stubMessageBox(app)
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openFileInSource(name: string): Promise<void> {
  await openFolder(window)
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
}

/** Deterministic caret for tests that count from the top: the seeded caret
 *  otherwise sits where the visual caret was mapped, which varies. The source
 *  editor has no default keymap, so the caret is placed by clicking the start
 *  of the first line rather than with Control+Home. */
async function caretToDocumentStart(): Promise<void> {
  await window
    .locator('.cm-line')
    .first()
    .click({ position: { x: 1, y: 5 } })
}

function searchPanel() {
  return window.getByTestId('search-panel')
}

function searchInput() {
  return window.getByTestId('search-input')
}

function searchCount() {
  return window.getByTestId('search-count')
}

/** All rendered match highlights; the current match carries the extra class. */
function highlightCount(): ReturnType<Page['locator']> {
  return window.locator('.cm-searchMatch')
}

function currentHighlight() {
  return window.locator('.cm-searchMatch-current')
}

/** Whether the current-match highlight sits inside the source scroller's
 *  viewport, i.e. the search brought it into view. */
async function currentMatchVisible(): Promise<boolean> {
  return window.evaluate(() => {
    const scroller = document.querySelector('.source-view .cm-scroller')
    const el = document.querySelector('.cm-searchMatch-current')
    if (!scroller || !el) return false
    const h = scroller.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return r.top >= h.top - 1 && r.bottom <= h.bottom + 1
  })
}

test.describe('source search (spec 056)', () => {
  test('Ctrl+F and the toolbar control open the box, empty and focused (FR-001)', async () => {
    await openFileInSource('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toBeFocused()
    await expect(searchInput()).toHaveValue('')
    await expect(searchCount()).toHaveText('')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)

    await window.getByTestId('source-find-button').click()
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toBeFocused()
    await expect(searchInput()).toHaveValue('')
  })

  test('live matching highlights every occurrence with a count, frontmatter included (US1, FR-002/003/005/011)', async () => {
    await openFileInSource('fixture.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().pressSequentially('needle')
    await expect(searchCount()).toHaveText('1 of 4')
    await expect(highlightCount()).toHaveCount(4)
    await expect(currentHighlight()).toHaveCount(1)
    // The first occurrence lives in the frontmatter title line (FR-011).
    const currentLine = await currentHighlight().evaluate(
      (el) => el.closest('.cm-line')?.textContent ?? ''
    )
    expect(currentLine.startsWith('title:')).toBe(true)

    // The count updates live with each keystroke, no submit step.
    await searchInput().pressSequentially(' h')
    await expect(searchCount()).toHaveText('1 of 1')
    await expect(highlightCount()).toHaveCount(1)
  })

  test('the caret sits on the current match and the match is scrolled into view (FR-004)', async () => {
    await openFileInSource('caret.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('marker')
    await expect(searchCount()).toHaveText('1 of 9')
    // The first match is far below the initial viewport; the search must have
    // brought it into view.
    await expect
      .poll(currentMatchVisible, { timeout: 5_000, intervals: [100, 250, 500, 1_000] })
      .toBe(true)
    // After dismissal the caret continues from the match: typing appends to
    // the matched word on the very line the search landed on.
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await window.keyboard.type('X')
    await expect(window.locator('.cm-line', { hasText: 'markerX' })).toHaveCount(1)
  })

  test('next and previous wrap at both ends; Enter and Shift+Enter navigate (US2, FR-006/007)', async () => {
    await openFileInSource('fixture.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 4')
    for (let i = 2; i <= 4; i++) {
      await window.getByTestId('search-next').click()
      await expect(searchCount()).toHaveText(`${i} of 4`)
    }
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('1 of 4')
    await window.getByTestId('search-prev').click()
    await expect(searchCount()).toHaveText('4 of 4')

    await searchInput().press('Enter')
    await expect(searchCount()).toHaveText('1 of 4')
    await searchInput().press('Shift+Enter')
    await expect(searchCount()).toHaveText('4 of 4')
  })

  test('search behaves identically with word wrap on and off, changing neither (FR-013)', async () => {
    await openFileInSource('wrap.md')
    await caretToDocumentStart()
    const wrapCheckbox = window.getByTestId('source-word-wrap')
    await expect(wrapCheckbox).not.toBeChecked()

    await wrapCheckbox.click()
    await expect(wrapCheckbox).toBeChecked()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 3')
    await expect(highlightCount()).toHaveCount(3)
    await expect(wrapCheckbox).toBeChecked()
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await expect(wrapCheckbox).toBeChecked()

    await wrapCheckbox.click()
    await expect(wrapCheckbox).not.toBeChecked()
    // The first search left the caret at match 1's end; reset it so the second
    // search starts from the top like the first one did.
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 3')
    await expect(highlightCount()).toHaveCount(3)
    await expect(wrapCheckbox).not.toBeChecked()
  })

  test('Escape keeps unsaved edits and dirty state, removes highlights, restores focus (US3, FR-008/009)', async () => {
    await openFileInSource('fixture.md')
    await window.getByTestId('source-textarea').click()
    await window.keyboard.press('Control+End')
    await window.keyboard.type(' EDITED-TAIL')
    await expect(window.locator('.document-title')).toContainText('\u2022')

    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 4')
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('2 of 4')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await expect(highlightCount()).toHaveCount(0)

    // The edit survived and the document is still dirty.
    await expect(window.getByTestId('source-view')).toContainText('EDITED-TAIL')
    await expect(window.locator('.document-title')).toContainText('\u2022')
    // Focus returned to the text; typing continues from where navigation left
    // the caret (the second match).
    const focusInSource = await window.evaluate(
      () => document.activeElement?.classList.contains('source-textarea') ?? false
    )
    expect(focusInSource).toBe(true)
    await window.keyboard.type('X')
    await expect(window.locator('.cm-line', { hasText: 'NeedleX' })).toHaveCount(1)
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('searching and dismissing a clean document keeps it clean (US3-3)', async () => {
    await openFileInSource('plain.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('nothing-matches-this')
    await expect(searchCount()).toHaveText('No matches')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('zero matches render calmly: a muted note, disabled navigation, no highlights (US1-6)', async () => {
    await openFileInSource('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('nothing-matches-this')
    await expect(searchCount()).toHaveText('No matches')
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.getByTestId('search-next')).toBeDisabled()
    await expect(window.getByTestId('search-prev')).toBeDisabled()
    await expect(searchPanel()).toBeVisible()
  })

  test('search does not carry across tab switches and restarts empty (US3-5, FR-014)', async () => {
    await openFileInSource('fixture.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 4')

    await window.getByRole('button', { name: 'Open menu' }).click()
    await window.getByRole('menuitem', { name: 'New File' }).click()
    await expect(searchPanel()).toHaveCount(0)

    await window.locator('.tab', { hasText: 'fixture.md' }).click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await expect(searchPanel()).toHaveCount(0)
    await caretToDocumentStart()
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toHaveValue('')
    await expect(searchCount()).toHaveText('')
  })

  test('a 10,000-line document searches responsively and reveals the match (FR-012, SC-002)', async () => {
    test.setTimeout(120_000)
    await openFileInSource('huge.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('zebra')
    await expect(searchCount()).toHaveText('1 of 50')
    await expect
      .poll(currentMatchVisible, { timeout: 5_000, intervals: [100, 250, 500, 1_000] })
      .toBe(true)
    await searchInput().press('Enter')
    await expect(searchCount()).toHaveText('2 of 50')
    await expect.poll(currentMatchVisible).toBe(true)
  })
})
