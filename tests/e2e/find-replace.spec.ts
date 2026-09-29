import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, stubTrash, stubMessageBox, pressShortcut } from './launch'

/**
 * Spec 061: plain, literal, case-insensitive find and replace in both editing
 * views. Covers the acceptance scenarios of US1 (replace one), US2 (Replace
 * All), and US3 (safe, scoped, view-correct), including single-step undo and
 * the deterministic non-overlapping policy.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const FILLER_SENTENCE = 'The quick brown fox jumps over the lazy dog near the river bank.'

function replaceFixture(): string {
  return [
    '# Apple pie',
    '',
    'An apple a day keeps the doctor away.',
    '',
    '- apple in a list',
    '- plain item',
    '',
    'Closing apple, apple, apple.',
    ''
  ].join('\n')
}

function overlapFixture(): string {
  return ['# Banana', '', 'A banana in a hammock.', ''].join('\n')
}

function boldFixture(): string {
  return ['# Format demo', '', 'Some **bold** word and plain word.', ''].join('\n')
}

function spanFixture(): string {
  return ['# Span demo', '', 'before **bo**ld after', ''].join('\n')
}

function advanceFixture(): string {
  return ['# Advance demo', '', 'apple one', '', 'apple two', '', 'apple three', ''].join('\n')
}

function sourceFixture(): string {
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

/** ~10,000 source lines, every 100th paragraph containing the search word. */
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

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-find-replace-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'recipe.md'), replaceFixture())
  fs.writeFileSync(path.join(testFolder, 'overlap.md'), overlapFixture())
  fs.writeFileSync(path.join(testFolder, 'bold.md'), boldFixture())
  fs.writeFileSync(path.join(testFolder, 'span.md'), spanFixture())
  fs.writeFileSync(path.join(testFolder, 'advance.md'), advanceFixture())
  fs.writeFileSync(path.join(testFolder, 'source.md'), sourceFixture())
  fs.writeFileSync(path.join(testFolder, 'other.md'), '# Other document\n\nUntouched words.')
  fs.writeFileSync(path.join(testFolder, 'huge.md'), buildHugeDoc())
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-find-replace-config-'))
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

async function openFolder(): Promise<void> {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
  await expect(window.getByRole('treeitem').first()).toBeVisible()
}

async function openVisual(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  // The mount-time syntax reconfiguration replaces every ProseMirror DOM node
  // shortly after the surface appears; let it finish before searching.
  await window.waitForTimeout(700)
}

async function openSource(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
}

/** Deterministic source caret: the seeded caret otherwise depends on the
 *  visual caret mapped over. Click near the start of the first line. */
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
function replaceInput() {
  return window.getByTestId('search-replace-input')
}
function replaceButton() {
  return window.getByTestId('search-replace')
}
function replaceAllButton() {
  return window.getByTestId('search-replace-all')
}
function replaceToggle() {
  return window.getByTestId('search-replace-toggle')
}

/** All visual match highlights, including code-block node highlights. */
function highlightCount(): ReturnType<Page['locator']> {
  return window.locator(
    '.mm-search-match, .mm-search-current, .mm-search-match-node, .mm-search-current-node'
  )
}

async function enterReplacement(text: string): Promise<void> {
  await replaceInput().fill(text)
}

async function revealReplaceWithQuery(query: string): Promise<void> {
  await pressShortcut(app, 'h', ['control'])
  await expect(searchPanel()).toBeVisible()
  await searchInput().fill(query)
}

test.describe('find and replace in visual editing (spec 061 US1/US2/US3)', () => {
  test('Ctrl+H opens the box with the replace row revealed (FR-001/002/014)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await pressShortcut(app, 'h', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(replaceInput()).toBeVisible()
    await expect(replaceInput()).toBeFocused()
    await expect(replaceButton()).toBeVisible()
    await expect(replaceAllButton()).toBeVisible()
    await searchInput().fill('apple')
    await expect(searchCount()).toHaveText('1 of 6')
  })

  test('the toggle reveals the row without changing the matches (US1-1)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('apple')
    await expect(searchCount()).toHaveText('1 of 6')
    await expect(replaceInput()).toHaveCount(0)
    await replaceToggle().click()
    await expect(replaceInput()).toBeVisible()
    await expect(searchCount()).toHaveText('1 of 6')
  })

  test('replace changes only the current occurrence, advances, recomputes, dirties (US1-2)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await expect(searchCount()).toHaveText('1 of 6')
    await enterReplacement('pear')
    await replaceButton().click()
    await expect(searchCount()).toHaveText('1 of 5')
    await expect(window.locator('.ProseMirror h1')).toHaveText('pear pie')
    await expect(window.locator('.ProseMirror')).toContainText('An apple a day')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('replace current advances to the next remaining occurrence (US1-2, FR-004)', async () => {
    await openFolder()
    await openVisual('advance.md')
    await revealReplaceWithQuery('apple')
    await expect(searchCount()).toHaveText('1 of 3')
    await enterReplacement('pear')
    await replaceButton().click()
    await expect(searchCount()).toHaveText('1 of 2')
    const firstCurrent = await window
      .locator('.mm-search-current')
      .evaluate((el) => el.closest('p')?.textContent ?? '')
    expect(firstCurrent).toContain('apple two')
    await replaceButton().click()
    await expect(searchCount()).toHaveText('1 of 1')
    const secondCurrent = await window
      .locator('.mm-search-current')
      .evaluate((el) => el.closest('p')?.textContent ?? '')
    expect(secondCurrent).toContain('apple three')
  })

  test('replace current never re-processes its own replacement (US1-2, FR-008)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await expect(searchCount()).toHaveText('1 of 6')
    await enterReplacement('apples')
    await replaceButton().click()
    await expect(window.locator('.ProseMirror h1')).toHaveText('apples pie')
    // The second replace changes the next original occurrence; the inserted
    // 'apples' is skipped, so the heading is not corrupted.
    await replaceButton().click()
    await expect(window.locator('.ProseMirror h1')).toHaveText('apples pie')
    await expect(window.locator('.ProseMirror')).toContainText('An apples a day')
  })

  test('an empty replacement deletes the matched text (US1-3)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await replaceButton().click()
    await expect(searchCount()).toHaveText('1 of 5')
    await expect(window.locator('.ProseMirror h1')).toHaveText(' pie')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('the replace controls are inert while nothing matches (US1-4, FR-010)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await pressShortcut(app, 'h', ['control'])
    await searchInput().fill('nothing-matches-this')
    await expect(searchCount()).toHaveText('No matches')
    await expect(replaceButton()).toBeDisabled()
    await expect(replaceAllButton()).toBeDisabled()
  })

  test('Replace All changes every occurrence and recomputes the count (US2-1/2)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await expect(searchCount()).toHaveText('1 of 6')
    await enterReplacement('pear')
    await replaceAllButton().click()
    await expect(searchCount()).toHaveText('No matches')
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.locator('.ProseMirror h1')).toHaveText('pear pie')
    await expect(window.locator('.ProseMirror')).not.toContainText('apple')
    await expect(window.locator('.ProseMirror')).toContainText('pear, pear, pear.')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('inserted replacement text is never re-processed (US2-5, FR-008)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('apples')
    await replaceAllButton().click()
    // Each inserted 'apples' still contains one 'apple'; none is replaced again.
    await expect(searchCount()).toHaveText('1 of 6')
    await expect(window.locator('.ProseMirror')).not.toContainText('appleses')
  })

  test('Replace All takes the leftmost non-overlapping matches (US2-6, FR-017)', async () => {
    await openFolder()
    await openVisual('overlap.md')
    await revealReplaceWithQuery('ana')
    // 'ana' occurs twice in each 'Banana'/'banana'; find counts all four
    // overlapping candidates, but replacement can only change two.
    await expect(searchCount()).toHaveText('1 of 4')
    await enterReplacement('X')
    await replaceAllButton().click()
    await expect(searchCount()).toHaveText('No matches')
    await expect(window.locator('.ProseMirror h1')).toHaveText('BXna')
    await expect(window.locator('.ProseMirror')).toContainText('A bXna in a hammock.')
  })

  test('one undo reverses a single replace as one step (US1-5, FR-006)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await replaceButton().click()
    await expect(window.locator('.ProseMirror h1')).toHaveText('pear pie')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror h1')).toHaveText('Apple pie')
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('one undo reverses Replace All as a single step (US2-3)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await replaceAllButton().click()
    await expect(window.locator('.ProseMirror')).not.toContainText('apple')
    await searchInput().press('Escape')
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror h1')).toHaveText('Apple pie')
    await expect(window.locator('.ProseMirror')).toContainText('apple a day')
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('dismissing keeps the replacements and removes every highlight (US3-3, FR-011)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await replaceButton().click()
    // One of the six occurrences was replaced, so five highlights remain.
    await expect(highlightCount()).toHaveCount(5)
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await expect(highlightCount()).toHaveCount(0)
    await expect(window.locator('.ProseMirror h1')).toHaveText('pear pie')
  })

  test('the replacement keeps the formatting at the match start (US3-7, FR-019)', async () => {
    await openFolder()
    await openVisual('bold.md')
    await revealReplaceWithQuery('bold')
    await expect(searchCount()).toHaveText('1 of 1')
    await enterReplacement('brave')
    await replaceButton().click()
    await expect(window.locator('.ProseMirror strong')).toHaveText('brave')
    await expect(window.locator('.ProseMirror p')).toHaveText('Some brave word and plain word.')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('a match spanning formatted text keeps the first character formatting (US3-7, FR-019)', async () => {
    await openFolder()
    await openVisual('span.md')
    // The rendered run is "bold": "bo" is bold and "ld" is plain, so the match
    // spans a formatting boundary.
    await revealReplaceWithQuery('bold')
    await expect(searchCount()).toHaveText('1 of 1')
    await enterReplacement('X')
    await replaceButton().click()
    await expect(window.locator('.ProseMirror strong')).toHaveText('X')
    await expect(window.locator('.ProseMirror p')).toHaveText('before X after')
  })

  test('typing after a replace is a separate undo step (FR-006)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await replaceAllButton().click()
    await searchInput().press('Escape')
    await window.locator('.ProseMirror p', { hasText: 'An pear a day' }).click()
    await window.keyboard.press('End')
    await window.keyboard.type('ZED')
    await expect(window.locator('.ProseMirror')).toContainText('ZED')
    // One undo removes only the typing; the replace survives.
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror')).not.toContainText('ZED')
    await expect(window.locator('.ProseMirror h1')).toHaveText('pear pie')
    // The next undo removes the replace.
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror h1')).toHaveText('Apple pie')
  })

  test('replace state does not survive a view switch (FR-015)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await expect(replaceInput()).toHaveValue('pear')
    await window.getByRole('button', { name: 'View source' }).click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await expect(searchPanel()).toHaveCount(0)
    await window.getByRole('button', { name: 'Back to visual editing' }).click()
    // The visual host stays mounted behind the source overlay, so wait for the
    // overlay itself to go before reopening.
    await expect(window.getByTestId('source-view')).toHaveCount(0)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(replaceInput()).toHaveCount(0)
    await expect(searchInput()).toHaveValue('')
  })

  test('an edit made before the replace stays undoable after it (US3-6, FR-006)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await window.locator('.ProseMirror p', { hasText: 'An apple a day' }).click()
    await window.keyboard.press('End')
    await window.keyboard.type(' EXTRA')
    await expect(window.locator('.document-title')).toContainText('\u2022')
    await pressShortcut(app, 'f', ['control'])
    await searchInput().fill('apple')
    await replaceToggle().click()
    await enterReplacement('pear')
    await replaceAllButton().click()
    await searchInput().press('Escape')
    // One undo removes only the replacements; the earlier typed edit remains
    // and the document is still dirty.
    await window.keyboard.press('Control+z')
    await expect(window.locator('.ProseMirror h1')).toHaveText('Apple pie')
    await expect(window.locator('.ProseMirror')).toContainText('apple a day')
    await expect(window.locator('.ProseMirror')).toContainText('EXTRA')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('replace state does not survive a tab switch (FR-015)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await expect(replaceInput()).toHaveValue('pear')
    // New File via the hamburger moves to another tab; the box closes.
    await window.getByRole('button', { name: 'Open menu' }).click()
    await window.getByRole('menuitem', { name: 'New File' }).click()
    await expect(searchPanel()).toHaveCount(0)
    await window.locator('.tab', { hasText: 'recipe.md' }).click()
    await pressShortcut(app, 'f', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(replaceInput()).toHaveCount(0)
    await expect(searchInput()).toHaveValue('')
  })

  test('replace never touches another open document (FR-007, SC-005)', async () => {
    await openFolder()
    await openVisual('recipe.md')
    await window.getByRole('treeitem').getByText('other.md').dblclick()
    await expect(window.locator('.tab', { hasText: 'other.md' })).toBeVisible()
    await window.locator('.tab', { hasText: 'recipe.md' }).click()
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await revealReplaceWithQuery('apple')
    await enterReplacement('pear')
    await replaceAllButton().click()
    await expect(window.locator('.document-title')).toContainText('\u2022')

    await window.locator('.tab', { hasText: 'other.md' }).click()
    await expect(window.locator('.ProseMirror:visible')).toContainText('Untouched words.')
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('a 10,000-line document replaces all occurrences responsively (FR-013, SC-004)', async () => {
    test.setTimeout(120_000)
    await openFolder()
    await openVisual('huge.md')
    await revealReplaceWithQuery('zebra')
    await expect(searchCount()).toHaveText('1 of 50')
    await enterReplacement('horse')
    await replaceAllButton().click()
    await expect(searchCount()).toHaveText('No matches')
    await expect(window.locator('.ProseMirror')).not.toContainText('Zebra')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })
})

test.describe('find and replace in source editing (spec 061 US3)', () => {
  test('Ctrl+H reveals replace and a single replace rewrites the raw markdown (US3-2, FR-018)', async () => {
    await openFolder()
    await openSource('source.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'h', ['control'])
    await expect(searchPanel()).toBeVisible()
    await expect(replaceInput()).toBeVisible()
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 4')
    await enterReplacement('thread')
    await replaceButton().click()
    // The first match is the frontmatter title; replacing it rewrites the raw
    // markdown, so the frontmatter block is in scope.
    await expect(searchCount()).toHaveText('1 of 3')
    await expect(window.getByTestId('source-view')).toContainText('title: thread hunt')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('source Replace All rewrites frontmatter and body (US2, FR-018)', async () => {
    await openFolder()
    await openSource('source.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'h', ['control'])
    await searchInput().fill('needle')
    await expect(searchCount()).toHaveText('1 of 4')
    await enterReplacement('thread')
    await replaceAllButton().click()
    await expect(searchCount()).toHaveText('No matches')
    const source = window.getByTestId('source-view')
    await expect(source).toContainText('title: thread hunt')
    await expect(source).toContainText('# thread in the body')
    await expect(source).toContainText('And thread once more by the sea.')
    // Replace does not touch the word wrap setting (FR-016).
    await expect(window.getByTestId('source-word-wrap')).not.toBeChecked()
  })

  test('source replace is a single undo step (FR-006)', async () => {
    await openFolder()
    await openSource('source.md')
    await caretToDocumentStart()
    await pressShortcut(app, 'h', ['control'])
    await searchInput().fill('needle')
    await enterReplacement('thread')
    await replaceAllButton().click()
    await expect(window.getByTestId('source-view')).toContainText('title: thread hunt')
    await searchInput().press('Escape')
    await expect(searchPanel()).toHaveCount(0)
    await window.keyboard.press('Control+z')
    await expect(window.getByTestId('source-view')).toContainText('title: needle hunt')
    await expect(window.getByTestId('source-view')).not.toContainText('title: thread hunt')
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('raw markdown syntax matches in source, not in visual editing (FR-018)', async () => {
    await openFolder()
    await openVisual('bold.md')
    await revealReplaceWithQuery('**')
    await expect(searchCount()).toHaveText('No matches')
    await searchInput().press('Escape')
    await window.getByRole('button', { name: 'View source' }).click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await caretToDocumentStart()
    await pressShortcut(app, 'h', ['control'])
    await searchInput().fill('**')
    await expect(searchCount()).toHaveText('1 of 2')
    // Markdown syntax characters are replaced literally, never interpreted.
    await enterReplacement('++')
    await replaceAllButton().click()
    await expect(searchCount()).toHaveText('No matches')
    await expect(window.getByTestId('source-view')).toContainText('Some ++bold++ word and plain word.')
  })
})
