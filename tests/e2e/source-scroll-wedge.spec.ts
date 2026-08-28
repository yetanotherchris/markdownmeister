import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  launchApp,
  closeAppSafely,
  stubTrash,
  openFolder as openWorkspaceFolder,
  openFile
} from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const LINES = 400
const SCROLL_TO = 1000

function writeScrollDocument(): void {
  const lines = Array.from({ length: LINES }, (_, i) => `Paragraph ${i} of the scroll document.`)
  fs.writeFileSync(path.join(testFolder, 'scroll.md'), lines.join('\n\n'))
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-source-scroll-e2e-'))
  writeScrollDocument()
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-source-scroll-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
  await stubTrash(app)
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

/** Scroll the formatted editor's scroll container, verify the offset took
 *  effect, click in the visible prose, then toggle View source. */
async function scrollToAndToggle(scrollTop: number): Promise<void> {
  await window.evaluate((top) => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement
    host.scrollTop = top
  }, scrollTop)
  const applied = await window
    .locator('.editor-host:not(.has-source)')
    .evaluate((el) => el.scrollTop)
  expect(applied).toBe(scrollTop)
  const hostBox = (await window.locator('.editor-host').first().boundingBox()) as {
    x: number
    y: number
    width: number
    height: number
  }
  await window.mouse.click(hostBox.x + hostBox.width / 2, hostBox.y + hostBox.height / 2)
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
  // Until the slide-in settles, the overlay is translated away from the host
  // and would not receive clicks or wheel events at the pane centre.
  await expect(window.getByTestId('source-view')).toHaveCSS('transform', 'none')
}

/** Reads the visual caret as (top-level block index, intra-block character
 *  offset) plus the pane scroll, all through DOM evaluation. */
async function readVisualCaret(): Promise<{
  blockIndex: number
  offset: number
  scrollTop: number
}> {
  return window.evaluate(() => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement | null
    const pm = host?.querySelector('.ProseMirror')
    const sel = window.getSelection()
    if (!host || !pm || !sel || sel.anchorNode === null) throw new Error('no visual selection')
    const blocks = Array.from(pm.children)
    let block: Node | null = sel.anchorNode
    while (block && block.parentNode !== pm) block = block.parentNode
    const range = document.createRange()
    range.selectNodeContents(block as Node)
    range.setEnd(sel.anchorNode, sel.anchorOffset)
    return {
      blockIndex: blocks.indexOf(block as Element),
      offset: range.toString().length,
      scrollTop: host.scrollTop
    }
  })
}

test.describe('source view after scrolling the formatted editor', () => {
  test('US1 entering source view resets the host scroll so the overlay covers the editor', async () => {
    await openWorkspaceFolder(window)
    await openFile(window, 'scroll.md')

    await scrollToAndToggle(SCROLL_TO)

    // The overlay is anchored at the scroll container's content origin, so a
    // retained scrollTop pushes it out of the viewport and exposes the locked
    // ProseMirror underneath.
    const hostScroll = await window
      .locator('.editor-host.has-source')
      .evaluate((el) => el.scrollTop)
    expect(hostScroll).toBe(0)
  })

  test('US1 the source surface receives clicks and input after a scrolled toggle', async () => {
    await openWorkspaceFolder(window)
    await openFile(window, 'scroll.md')

    await scrollToAndToggle(SCROLL_TO)
    await expect(window.getByTestId('source-view')).toHaveCSS('transform', 'none')

    const hostBox = (await window.locator('.editor-host.has-source').boundingBox()) as {
      x: number
      y: number
      width: number
      height: number
    }
    await window.mouse.click(hostBox.x + hostBox.width / 2, hostBox.y + hostBox.height / 2)
    const onSourceSurface = await window.evaluate(() => {
      const host = document.querySelector('.editor-host.has-source') as HTMLElement
      const box = host.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return hit?.closest('[data-testid="source-textarea"]') != null
    })
    expect(onSourceSurface).toBe(true)

    // The visible surface must accept typed input (not a wedged frame).
    await window.keyboard.type('RESPONSIVE-AFTER-SCROLL')
    await expect(window.getByTestId('source-textarea')).toContainText('RESPONSIVE-AFTER-SCROLL')
    await expect(window.locator('.document-title')).toContainText('\u2022')
  })

  test('US1 the source view scrolls with the wheel after a scrolled toggle', async () => {
    await openWorkspaceFolder(window)
    await openFile(window, 'scroll.md')

    await scrollToAndToggle(SCROLL_TO)

    const hostBox = (await window.locator('.editor-host.has-source').boundingBox()) as {
      x: number
      y: number
      width: number
      height: number
    }
    await window.mouse.move(hostBox.x + hostBox.width / 2, hostBox.y + hostBox.height / 2)
    await window.mouse.wheel(0, 300)
    // The wheel event is dispatched asynchronously; the scroll lands on a
    // later frame.
    await expect
      .poll(() =>
        window
          .locator('.editor-host.has-source .cm-scroller')
          .evaluate((el) => el.scrollTop)
      )
      .toBeGreaterThan(0)
  })

  test('SC-002 returning to formatted editing restores the caret and scroll of a scrolled editor', async () => {
    await openWorkspaceFolder(window)
    await openFile(window, 'scroll.md')

    // Place the caret in a block below the fold, then scroll the pane and
    // click so the round trip starts from a genuinely scrolled, selected
    // state. The caret snapshot must come from the formatted view, before the
    // toggle.
    await window
      .locator('[contenteditable="true"] p', { hasText: `Paragraph ${LINES - 40}` })
      .click()
    await window.keyboard.press('End')
    await window.evaluate((top) => {
      const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement
      host.scrollTop = top
    }, SCROLL_TO)
    const hostBox = (await window.locator('.editor-host').first().boundingBox()) as {
      x: number
      y: number
      width: number
      height: number
    }
    await window.mouse.click(hostBox.x + hostBox.width / 2, hostBox.y + hostBox.height / 2)
    const before = await readVisualCaret()

    await window.getByRole('button', { name: 'View source' }).click()
    await expect(window.getByTestId('source-view')).toBeVisible()
    await window.getByRole('button', { name: /Back to visual editing/ }).click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)

    const after = await readVisualCaret()
    expect(after).toEqual(before)
  })
})
