import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  launchApp,
  closeAppSafely,
  stubTrash,
  stubMessageBox,
  pressShortcut,
  clickHamburgerItem,
  openHamburger
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

function searchFixture(): string {
  return [
    '# needle at the top',
    '',
    'Beta paragraph mentions needle once.',
    '',
    '- list item with needle inside',
    '- plain item',
    '',
    '| Col a | Col b |',
    '| ----- | ----- |',
    '| needle in a cell | x |',
    '',
    '```js',
    'needle in code',
    '```',
    '',
    '> quote mentioning needle too',
    '',
    'Closing paragraph: needle, needle, needle.',
    ''
  ].join('\n')
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-visual-search-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'fixture.md'), searchFixture())
  fs.writeFileSync(path.join(testFolder, 'huge.md'), buildHugeDoc())
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-visual-search-config-'))
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

async function openFile(name: string): Promise<void> {
  await openHamburger(window)
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
  await expect(window.getByRole('treeitem').first()).toBeVisible()
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  // The mount-time syntax reconfiguration replaces every ProseMirror DOM
  // node shortly after the surface appears; let it finish before searching.
  await window.waitForTimeout(700)
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

/** All match highlights: the current match carries its own class, the rest
 *  the plain one; code-block matches highlight the block instead of the
 *  text (R6), so the node classes are part of the total. */
function highlightCount(): ReturnType<Page['locator']> {
  return window.locator(
    '.mm-search-match, .mm-search-current, .mm-search-match-node, .mm-search-current-node'
  )
}

async function currentMatchVisible(): Promise<boolean> {
  return window.evaluate(() => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement | null
    const el = document.querySelector('.mm-search-current') as HTMLElement | null
    if (!host || !el) return false
    const h = host.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return r.top >= h.top - 1 && r.bottom <= h.bottom + 1
  })
}

/** The DOM selection the editor caret sits at. Opening the box moves focus,
 *  not the caret, so anchor and offset must survive that. */
async function caretSelection(): Promise<{ node: string | null; offset: number }> {
  return window.evaluate(() => {
    const selection = window.getSelection()
    return {
      node: selection?.anchorNode?.nodeName ?? null,
      offset: selection?.anchorOffset ?? -1
    }
  })
}

test.describe('visual search (spec 055)', () => {
  test('Ctrl+F opens the find box without moving the caret or content (FR-001, US1-1)', async () => {
    await openFile('fixture.md')
    await window.locator('.ProseMirror p').first().click()
    const caretBefore = await caretSelection()
    const before = await window.locator('.ProseMirror').textContent()
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toBeFocused()
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    // While the box is open the DOM selection follows focus into the input,
    // so the caret is compared after dismissal: ProseMirror restores its
    // selection on refocus, and it must be exactly where the search began.
    // The restore lands in a browser task after focus, so poll for it.
    await expect
      .poll(caretSelection, { timeout: 3_000, intervals: [50, 100, 250] })
      .toEqual(caretBefore)
    expect(await window.locator('.ProseMirror').textContent()).toBe(before)
  })

  test('the hamburger Find control opens it too (FR-001)', async () => {
    await openFile('fixture.md')
    // Deliberately not clickHamburgerItem: it refocuses the menu trigger
    // afterwards, which would race the panel's autofocus. Real clicks close
    // the menu first, so the panel wins focus, as in real use.
    await openHamburger(window)
    await window.getByRole('menuitem', { name: 'Find' }).click()
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toBeFocused()
  })

  test('typing shows live counts and highlights every occurrence (US1, FR-002/003/005)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().pressSequentially('nee')
    await expect(searchCount()).toHaveText('1 of 9')
    await searchInput().pressSequentially('dle')
    await expect(searchCount()).toHaveText('1 of 9')
    await expect(highlightCount()).toHaveCount(9)
    await expect(window.locator('.mm-search-current')).toHaveCount(1)
  })

  test('matches inside heading, quote, list, table, and code block are found (FR-011)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await expect(window.locator('h1 .mm-search-current')).toHaveCount(1)

    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('2 of 9')
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('3 of 9')
    await expect(window.locator('li .mm-search-current')).toHaveCount(1)
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('4 of 9')
    await expect(window.locator('td .mm-search-current')).toHaveCount(1)
    // Code blocks render through a CodeMirror node view; the match highlights
    // the block (R6) and the count still includes it.
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('5 of 9')
    await expect(window.locator('.milkdown-code-block.mm-search-current-node')).toHaveCount(1)
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('6 of 9')
    await expect(window.locator('blockquote .mm-search-current')).toHaveCount(1)
  })

  test('next and previous wrap around at both ends (US2, FR-006)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    for (let i = 2; i <= 9; i++) {
      await window.getByTestId('search-next').click()
      await expect(searchCount()).toHaveText(`${i} of 9`)
    }
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('1 of 9')
    await window.getByTestId('search-prev').click()
    await expect(searchCount()).toHaveText('9 of 9')
  })

  test('Enter and Shift+Enter navigate while focus is in the box (US2-4, FR-007)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await searchInput().press('Enter')
    await expect(searchCount()).toHaveText('2 of 9')
    await searchInput().press('Shift+Enter')
    await expect(searchCount()).toHaveText('1 of 9')
  })

  test('editing while the box is open refreshes counts and keeps it open (US2-5)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await window.locator('.ProseMirror p', { hasText: 'Closing paragraph' }).click()
    // A mid-paragraph caret could land inside an existing occurrence; move
    // to the end of the line so the typed word is a new, tenth match.
    await window.keyboard.press('End')
    await window.keyboard.type(' needle')
    await expect(searchCount()).toHaveText('1 of 10')
    await expect(highlightCount()).toHaveCount(10)
    await expect(searchPanel()).toBeVisible()
  })

  test('Escape closes cleanly: content identical, dirty clean, focus restored (US3, FR-008/009)', async () => {
    await openFile('fixture.md')
    const before = await window.locator('.ProseMirror').textContent()
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await expect(highlightCount()).toHaveCount(0)
    expect(await window.locator('.ProseMirror').textContent()).toBe(before)
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
    const focusInDocument = await window.evaluate(
      () => document.activeElement?.classList.contains('ProseMirror') ?? false
    )
    expect(focusInDocument).toBe(true)
  })

  test('the close control dismisses like Escape (FR-008)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await window.getByTestId('search-close').click()
    await expect(searchPanel()).toHaveCount(0)
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
    const focusInDocument = await window.evaluate(
      () => document.activeElement?.classList.contains('ProseMirror') ?? false
    )
    expect(focusInDocument).toBe(true)
  })

  test('search never occupies the undo stack (FR-009, SC-004)', async () => {
    await openFile('fixture.md')
    await window.locator('.ProseMirror p', { hasText: 'Closing paragraph' }).click()
    // End of the line, so the typed word neither splits an existing
    // occurrence nor lands mid-word.
    await window.keyboard.press('End')
    await window.keyboard.type(' extra')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await window.getByTestId('search-next').click()
    await expect(searchCount()).toHaveText('2 of 9')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    // Focus returned to the document, so undo reaches the editor directly and
    // removes only the word typed before the search: no search transaction
    // entered the undo stack.
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror')).not.toContainText('extra')
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('zero matches render calmly (US1-6)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('nothing-matches-this')
    await expect(searchCount()).toHaveText('No matches')
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.getByTestId('search-next')).toBeDisabled()
    await expect(window.getByTestId('search-prev')).toBeDisabled()
  })

  test('search does not carry across tab switches (US3-4, FR-013)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')

    await clickHamburgerItem(window, 'New File')
    await expect(searchPanel()).toHaveCount(0)

    await window.locator('.tab', { hasText: 'fixture.md' }).click()
    await expect(searchPanel()).toHaveCount(0)
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(searchInput()).toHaveValue('')
    await expect(searchCount()).toHaveText('')
  })

  test('search does not carry across a source-view switch (US3-4)', async () => {
    await openFile('fixture.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 9')
    await window.getByRole('button', { name: 'View source' }).click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await expect(searchPanel()).toHaveCount(0)
  })

  test('a 10,000-line document searches responsively and reveals the match (FR-012, SC-002)', async () => {
    await openFile('huge.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('zebra')
    await expect(searchCount()).toHaveText('1 of 50')
    await expect(highlightCount()).toHaveCount(50)
    // The first match is far below the initial viewport; the search must
    // have brought it into view (FR-004).
    await expect
      .poll(currentMatchVisible, { timeout: 5_000, intervals: [100, 250, 500, 1_000] })
      .toBe(true)
    await searchInput().press('Enter')
    await expect(searchCount()).toHaveText('2 of 50')
    await expect.poll(currentMatchVisible).toBe(true)
  })
})
