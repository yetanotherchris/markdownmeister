import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  launchApp,
  closeAppSafely,
  stubTrash,
  stubMessageBox,
  openFolder as openWorkspaceFolder
} from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

function buildLongDoc(): string {
  const parts: string[] = []
  for (let i = 1; i <= 24; i++) {
    parts.push(`## Heading ${i}`, ``, `PARA-${i} paragraph text for section number ${i}.`, ``)
    if (i === 12) {
      parts.push(`> QUOTE-TEXT quoted material lives here`, ``)
    }
    if (i === 14) {
      parts.push('```js', '// CODE-INNER fourteen', '```', ``)
    }
    if (i === 16) {
      parts.push(
        `| TBLCOL header one | TBLCOL header two |`,
        `| ----------------- | ----------------- |`,
        `| TBLCELL alpha     | TBLCELL beta      |`,
        ``
      )
    }
  }
  return parts.join('\n')
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-caret-sync-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'long.md'), buildLongDoc())
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-caret-sync-config-'))
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
  await openWorkspaceFolder(window)
}

async function openFile(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
  // The mount-time syntax reconfiguration replaces every ProseMirror DOM
  // node shortly after the surface appears; let it finish before caret work.
  await window.waitForTimeout(700)
}

function viewSourceButton(): ReturnType<Page['getByRole']> {
  return window.getByRole('button', { name: 'View source' })
}

function returnButton(): ReturnType<Page['getByRole']> {
  return window.getByRole('button', { name: /Back to visual editing/ })
}

/** Places the caret inside the visual block containing the marker. Done in a
 *  single evaluate on purpose: ProseMirror's content DOM is redrawn
 *  continuously by its plugins, so a selection set across separate evaluate
 *  calls would anchor into nodes that have already been replaced. */
async function placeVisualCaret(marker: string): Promise<void> {
  await window.evaluate((marker) => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement | null
    const pm = host?.querySelector('.ProseMirror') as HTMLElement | null
    if (!host || !pm) throw new Error('editor surface not found')
    let best: HTMLElement | null = null
    for (const el of Array.from(pm.querySelectorAll('*')) as HTMLElement[]) {
      if (!(el.textContent ?? '').includes(marker)) continue
      if (!best || best.contains(el)) best = el
    }
    if (!best) throw new Error(`no element contains ${marker}`)
    best.scrollIntoView({ block: 'center' })
    const walker = document.createTreeWalker(best, NodeFilter.SHOW_TEXT)
    const node = walker.nextNode()
    if (!node) throw new Error(`no text node in the block for ${marker}`)
    pm.focus()
    const range = document.createRange()
    range.setStart(node, Math.min(3, node.textContent?.length ?? 0))
    range.collapse(true)
    const selection = window.getSelection()
    if (!selection) throw new Error('no window selection')
    selection.removeAllRanges()
    selection.addRange(range)
  }, marker)
  await window.waitForTimeout(80)
}

interface VisualCaret {
  blockIndex: number
  offset: number
  scrollTop: number
  blockText: string
  visible: boolean
}

/** Reads the visual caret. The first DOM child of the ProseMirror surface is
 *  the virtual-cursor widget decoration, not a document block, so block
 *  indices skip it. */
async function readVisualCaret(): Promise<VisualCaret> {
  return window.evaluate(() => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement | null
    const pm = host?.querySelector('.ProseMirror')
    const selection = window.getSelection()
    if (!host || !pm || !selection || !selection.anchorNode) throw new Error('no visual selection')
    const isBlock = (el: Element) => !el.className.includes('prosemirror-virtual-cursor')
    const blocks = Array.from(pm.children).filter(isBlock)
    let block: Node | null = selection.anchorNode
    while (block && block.parentNode !== pm) block = block.parentNode
    const index = blocks.indexOf(block as HTMLElement)
    if (index < 0) throw new Error('caret is not inside a top-level block')
    const range = document.createRange()
    range.selectNodeContents(block as Node)
    range.setEnd(selection.anchorNode, selection.anchorOffset)
    const h = host.getBoundingClientRect()
    const b = (block as HTMLElement).getBoundingClientRect()
    // A horizontal scrollbar eats into the host's box, so the visible band
    // ends above its border-box bottom.
    const scrollbar = host.offsetHeight - host.clientHeight
    return {
      blockIndex: index,
      offset: range.toString().length,
      scrollTop: host.scrollTop,
      blockText: (block as HTMLElement).textContent ?? '',
      visible: b.top >= h.top - 1 && b.bottom <= h.bottom - scrollbar + 1
    }
  })
}

interface SourceCaret {
  lineIndex: number
  lineText: string
  visible: boolean
  scrollTop: number
}

async function readSourceCaret(): Promise<SourceCaret> {
  return window.evaluate(() => {
    const content = document.querySelector('.source-view .cm-content') as HTMLElement | null
    const scroller = document.querySelector('.source-view .cm-scroller') as HTMLElement | null
    if (!content) throw new Error('source content not found')
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.anchorNode) {
      throw new Error('no source selection')
    }
    const lines = Array.from(content.querySelectorAll(':scope > .cm-line')) as HTMLElement[]
    const lineIndex = lines.findIndex((line) => line.contains(selection.anchorNode))
    if (lineIndex < 0) throw new Error('source caret is not inside a rendered line')
    let visible = true
    if (scroller) {
      const s = scroller.getBoundingClientRect()
      const l = lines[lineIndex].getBoundingClientRect()
      visible = l.top >= s.top - 1 && l.bottom <= s.bottom + 1
    }
    return {
      lineIndex,
      lineText: lines[lineIndex].textContent ?? '',
      visible,
      scrollTop: scroller?.scrollTop ?? 0
    }
  })
}

/** Brings a source line into the rendered viewport and scrolls it into view;
 *  CodeMirror only materializes lines near the visible viewport. */
async function revealSourceLine(text: string): Promise<void> {
  await expect(async () => {
    const found = await window.evaluate((text) => {
      const scroller = document.querySelector('.source-view .cm-scroller') as HTMLElement | null
      if (!scroller) return false
      const line = Array.from(scroller.querySelectorAll('.cm-line')).find((line) =>
        line.textContent?.includes(text)
      )
      if (line) {
        line.scrollIntoView({ block: 'center' })
        return true
      }
      scroller.scrollTop += scroller.clientHeight * 0.6
      return false
    }, text)
    expect(found).toBe(true)
  }).toPass({ timeout: 10_000 })
  await window.waitForTimeout(60)
}

test.describe('caret line sync (spec 052)', () => {
  test('switching to source lands the caret on the paragraph you were reading (FR-001)', async () => {
    await openFolder()
    await openFile('long.md')
    await placeVisualCaret('PARA-18')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    const caret = await readSourceCaret()
    expect(caret.lineText).toContain('PARA-18')
    // A mid-document target is off screen at scroll zero, so landing on the
    // right line only counts when the view also reveals it.
    expect(caret.scrollTop).toBeGreaterThan(0)
    expect(caret.visible).toBe(true)
    // Positioning must not dirty the document (FR-006).
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('a caret in a heading, list, quote, or code block maps into that block (FR-002)', async () => {
    await openFolder()
    await openFile('long.md')

    const cases: Array<{ marker: string; match: RegExp }> = [
      { marker: 'Heading 20', match: /Heading 20/ },
      // The block is the mapping unit, so a caret in any list item maps to
      // the list's first line.
      { marker: 'QUOTE-TEXT', match: /QUOTE-TEXT/ },
      { marker: 'CODE-INNER', match: /```/ },
      { marker: 'TBLCELL alpha', match: /TBLCOL header one/ }
    ]
    for (const { marker, match } of cases) {
      await placeVisualCaret(marker)
      await viewSourceButton().click()
      await expect(window.getByTestId('source-view')).toBeVisible()
      const caret = await readSourceCaret()
      expect(caret.lineText, `marker ${marker}`).toMatch(match)
      await returnButton().click()
      await expect(window.getByTestId('source-view')).toHaveCount(0)
      await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    }
  })

  test('a caret in a list item maps to the list block (FR-002)', async () => {
    await openFolder()
    const doc = buildLongDoc().replace(
      'PARA-12 paragraph text for section number 12.',
      [
        'PARA-12 paragraph text for section number 12.',
        '',
        '- LIST-ONE item one',
        '- LIST-TWO item two',
        '- LIST-THREE item three'
      ].join('\n')
    )
    fs.writeFileSync(path.join(testFolder, 'list.md'), doc)
    await openFile('list.md')
    await placeVisualCaret('LIST-TWO')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    const caret = await readSourceCaret()
    expect(caret.lineText).toContain('LIST-ONE')
  })

  test('frontmatter is skipped entering source and maps to the body start on return (US1, US3)', async () => {
    await openFolder()
    fs.writeFileSync(
      path.join(testFolder, 'front.md'),
      `---\ntitle: front-test\n---\n\n${buildLongDoc()}`
    )
    await openFile('front.md')
    await placeVisualCaret('PARA-12')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    const caret = await readSourceCaret()
    expect(caret.lineText).toContain('PARA-12')
    // The sync never places the source caret inside the frontmatter (US1-4).
    expect(caret.lineText).not.toContain('title:')
    expect(caret.lineIndex).toBeGreaterThan(3)

    // A source caret parked in the frontmatter returns to the start of the
    // body, its closest visual counterpart (US3-2). The reveal above scrolled
    // the frontmatter out of the rendered viewport, so scroll back first.
    await window.evaluate(() => {
      const scroller = document.querySelector('.source-view .cm-scroller') as HTMLElement | null
      if (scroller) scroller.scrollTop = 0
    })
    await window.waitForTimeout(80)
    await window.locator('.source-view .cm-line', { hasText: 'title: front-test' }).click()
    await window.waitForTimeout(80)
    await returnButton().click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await window.waitForTimeout(60)
    const visual = await readVisualCaret()
    expect(visual.blockIndex).toBe(0)
    expect(visual.blockText).toContain('Heading 1')
  })

  test('a CRLF document maps by line, not by raw byte offset (FR-001)', async () => {
    await openFolder()
    fs.writeFileSync(path.join(testFolder, 'crlf.md'), buildLongDoc().replace(/\n/g, '\r\n'))
    await openFile('crlf.md')
    await placeVisualCaret('PARA-22')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    const caret = await readSourceCaret()
    expect(caret.lineText).toContain('PARA-22')
    expect(caret.visible).toBe(true)
  })

  test('an untouched round trip restores the visual caret and scroll exactly (FR-003)', async () => {
    await openFolder()
    await openFile('long.md')
    await placeVisualCaret('PARA-5')
    await window.evaluate(() => {
      const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement | null
      if (!host) throw new Error('editor surface not found')
      host.scrollTop = 220
    })
    await window.waitForTimeout(60)
    const before = await readVisualCaret()
    expect(before.scrollTop).toBe(220)

    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await returnButton().click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await window.waitForTimeout(60)

    const after = await readVisualCaret()
    expect(after.blockIndex).toBe(before.blockIndex)
    expect(after.offset).toBe(before.offset)
    expect(after.scrollTop).toBe(before.scrollTop)
    await expect(window.locator('.document-title')).not.toContainText('\u2022')
  })

  test('moving the source caret maps the return into that block (FR-004)', async () => {
    await openFolder()
    await openFile('long.md')
    await placeVisualCaret('PARA-3')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()

    await revealSourceLine('PARA-20')
    await window.locator('.source-view .cm-line', { hasText: 'PARA-20' }).click()
    await window.waitForTimeout(80)
    await returnButton().click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await window.waitForTimeout(60)

    const caret = await readVisualCaret()
    expect(caret.blockText).toContain('PARA-20')
    // FR-004 requires the mapped caret to be revealed on screen.
    expect(caret.visible).toBe(true)
  })

  test('editing in source preserves the edit and maps the return to the caret block (FR-004)', async () => {
    await openFolder()
    await openFile('long.md')
    await viewSourceButton().click()
    await expect(window.getByTestId('source-view')).toBeVisible()

    const edited = buildLongDoc().replace(
      'PARA-8 paragraph text for section number 8.',
      'PARA-8 EDITED-IN-SOURCE text.'
    )
    await window.getByTestId('source-textarea').fill(edited)
    await revealSourceLine('EDITED-IN-SOURCE')
    await window.locator('.source-view .cm-line', { hasText: 'EDITED-IN-SOURCE' }).click()
    await window.waitForTimeout(80)
    await returnButton().click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)
    await expect(window.locator('.ProseMirror:visible')).toBeVisible()
    await window.waitForTimeout(60)

    await expect(window.locator('.ProseMirror:visible')).toContainText('EDITED-IN-SOURCE')
    const caret = await readVisualCaret()
    expect(caret.blockText).toContain('EDITED-IN-SOURCE')
  })
})
