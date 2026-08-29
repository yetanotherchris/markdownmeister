import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile } from './launch'

/**
 * Spec 048 suite, migrated by spec 050 to the source view's header-bar toggle:
 * the two-state control defaulting off (FR-012), today's behaviour when off,
 * wrapped presentation when on, immediate application to open source views
 * (FR-011), mid-edit safety (FR-013), persistence and malformed-value
 * recovery, the far-right header-bar position and visible state (FR-009,
 * FR-010), absence from Settings (FR-008), an untouched visual editor
 * (FR-014), and a typing-latency smoke on a large wrapped document (SC-005).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const LONG_LINE = `# Alpha\n\n${'x'.repeat(4000)}\n\nHello world.\n`
const LONG_TOKEN = `# Token\n\n${'a'.repeat(3000)}\n\n${'b'.repeat(3000)}\n`

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-wrap-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), LONG_LINE)
  fs.writeFileSync(path.join(testFolder, 'token.md'), LONG_TOKEN)
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-wrap-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

function wordWrapToggle(): ReturnType<Page['getByTestId']> {
  return window.getByTestId('source-word-wrap')
}

async function toggleWordWrap(): Promise<void> {
  await wordWrapToggle().click()
}

/** Whether the CodeMirror scroller overflows horizontally right now. */
async function sourceOverflows(): Promise<boolean> {
  return window.locator('.source-view .cm-scroller').evaluate((el) => {
    return el.scrollWidth > el.clientWidth + 1
  })
}

async function openSourceView(name: string): Promise<void> {
  await openFile(window, name)
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
}

test('FR-009 the toggle sits at the far right of the header bar, back button far left', async () => {
  await openSourceView('alpha.md')

  const bar = window.locator('.source-toolbar')
  const positions = await bar.evaluate((toolbar) => {
    const back = toolbar.querySelector<HTMLButtonElement>('.source-return')
    const toggle = toolbar.querySelector<HTMLButtonElement>('.source-word-wrap')
    if (!back || !toggle) return null
    const barRect = toolbar.getBoundingClientRect()
    const backRect = back.getBoundingClientRect()
    const toggleRect = toggle.getBoundingClientRect()
    return {
      barLeft: barRect.left,
      backLeft: backRect.left,
      toggleLeft: toggleRect.left,
      toggleRightGap: barRect.right - toggleRect.right,
      leftGap: toggleRect.left - backRect.right
    }
  })
  if (!positions) throw new Error('toolbar buttons missing')
  // 16px toolbar padding plus a 1px rounding tolerance.
  const edgeTolerance = 17
  // The back button hugs the left edge, the toggle starts right of it and
  // hugs the right edge.
  expect(positions.backLeft - positions.barLeft).toBeLessThanOrEqual(edgeTolerance)
  expect(positions.toggleLeft).toBeGreaterThan(positions.backLeft)
  expect(positions.leftGap).toBeGreaterThan(0)
  expect(positions.toggleRightGap).toBeLessThanOrEqual(edgeTolerance)
})

/** The toggle's resolved background colour, for the pressed-state check. */
async function toggleBackground(): Promise<string> {
  return wordWrapToggle().evaluate((element) => getComputedStyle(element).backgroundColor)
}

/** The accent colour the pressed style keys on, resolved to rgb(). */
async function accentBackground(): Promise<string> {
  return window
    .locator('.source-view')
    .evaluate((surface) => getComputedStyle(surface).getPropertyValue('--mm-accent').trim())
    .then((accent) => {
      return window.evaluate((hex) => {
        const probe = document.createElement('span')
        probe.style.color = hex
        document.body.appendChild(probe)
        const rgb = getComputedStyle(probe).color
        probe.remove()
        return rgb
      }, accent)
    })
}

test('FR-010/FR-012 the toggle communicates its state and defaults to off', async () => {
  await openSourceView('alpha.md')

  const toggle = wordWrapToggle()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toHaveText('Word Wrap')
})

/** The toolbar's resolved background colour, the grey the off state keys on. */
async function toolbarBackground(): Promise<string> {
  return window.locator('.source-toolbar').evaluate((el) => getComputedStyle(el).backgroundColor)
}

test('FR-005 the toggle is grey when off and accent when on', async () => {
  await openSourceView('alpha.md')

  const off = await toggleBackground()
  const toolbar = await toolbarBackground()
  expect(off).toBe(toolbar)

  await toggleWordWrap()

  const on = await toggleBackground()
  expect(on).toBe(await accentBackground())
  expect(on).not.toBe(toolbar)

  // Toggling back off returns to the grey off state; move the pointer off
  // the button first so the hover rule does not tint the read.
  await toggleWordWrap()
  await window.mouse.move(0, 0)
  expect(await toggleBackground()).toBe(toolbar)
})

test('FR-008 the Settings Markdown area no longer offers word wrap', async () => {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Settings…' }).click()
  const dialog = window.getByTestId('settings-dialog')
  await dialog.waitFor()
  await dialog
    .getByRole('navigation', { name: 'Settings areas' })
    .getByRole('button', { name: 'Markdown' })
    .click()
  await expect(dialog.getByRole('group', { name: 'Markdown', exact: true })).toBeVisible()

  await expect(dialog.locator('input[name="word-wrap"]')).toHaveCount(0)
  await expect(dialog.getByText('Wrap long lines in source view')).toHaveCount(0)
  // The remaining Markdown-area switches are intact.
  await expect(dialog.getByText('Syntax highlight code blocks')).toBeVisible()
  await expect(dialog.getByText('Show the formatting bar')).toBeVisible()
})

test('US1 disabling matches today: long lines overflow with horizontal scrolling', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)
  const scrolled = await window.locator('.source-view .cm-scroller').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
    return el.scrollLeft > 0
  })
  expect(scrolled).toBe(true)
})

test('US1 enabling wraps lines inside the pane immediately, without reopening', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)

  const unpressed = await toggleBackground()
  await toggleWordWrap()

  // SC-005: the presentation changes within one second (the flip is
  // synchronous, so a generous default poll timeout would hide a stall).
  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(false)
  // The visible state matches the applied state (FR-010).
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'true')
  expect(await toggleBackground()).not.toBe(unpressed)
  expect(await toggleBackground()).toBe(await accentBackground())
  // The same source surface is still the live editing area.
  await expect(window.getByTestId('source-textarea')).toBeVisible()
})

test('FR-010 the toggle is operable from the keyboard', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)

  await wordWrapToggle().focus()
  await window.keyboard.press('Enter')
  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(false)
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'true')

  await window.keyboard.press('Space')
  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(true)
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'false')
})

test('FR-011 the choice applies to a source view opened later in the same session', async () => {
  await openSourceView('alpha.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(false)

  // Return to the visual editor and open the other document's source view.
  await window.getByRole('button', { name: 'Back to visual editing' }).click()
  await expect(window.getByTestId('source-view')).toHaveCount(0)
  await openSourceView('token.md')

  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(false)
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'true')
})

test('US1 edge case toggling wrap on while scrolled far right resets sanely', async () => {
  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)

  await window.locator('.source-view .cm-scroller').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await toggleWordWrap()

  // CodeMirror re-measures asynchronously after the compartment change, so the
  // wrapped geometry must be awaited before judging the horizontal offset.
  await expect.poll(sourceOverflows, { timeout: 1000 }).toBe(false)
  // The horizontal offset becomes meaningless and resets rather than erroring:
  // nothing is retained and pushing far right clamps instead of scrolling.
  const scroller = window.locator('.source-view .cm-scroller')
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0)
  expect(
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      return el.scrollLeft
    })
  ).toBe(0)
  await expect(window.getByTestId('source-textarea')).toBeVisible()
})

test('US1 unbroken tokens break within the pane when wrap is enabled', async () => {
  await openSourceView('token.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)
})

test('US2 toggling mid-edit preserves text, dirty state, selection, and the typing position', async () => {
  await openSourceView('alpha.md')
  const source = window.getByTestId('source-textarea')

  // An unsaved edit marks the tab dirty.
  await source.click()
  await window.keyboard.press('Control+End')
  await window.keyboard.type(' EDITED')
  const alphaTab = window.getByRole('tab', { name: /alpha\.md/ })
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()

  // A live selection spanning a word must keep its exact coverage.
  await window.keyboard.press('Control+Home')
  await window.keyboard.press('Shift+Control+ArrowRight')
  const selectionBefore = await window.evaluate(() => {
    const selection = document.getSelection()
    return { text: selection?.toString() ?? '', anchor: selection?.anchorOffset ?? -1 }
  })
  expect(selectionBefore.text.length).toBeGreaterThan(0)

  await toggleWordWrap()

  // Text, dirty state, and the selection survive the toggle.
  await expect(source).toContainText('EDITED')
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()
  const selectionAfter = await window.evaluate(() => {
    const selection = document.getSelection()
    return { text: selection?.toString() ?? '', anchor: selection?.anchorOffset ?? -1 }
  })
  expect(selectionAfter).toEqual(selectionBefore)

  // Typing continues exactly at the selection without any re-click, replacing it.
  // The toggle click moved focus to the button; refocusing the editor surface
  // restores the caret to the preserved selection without moving it.
  const fullTextBefore = await source.textContent()
  await source.focus()
  await window.keyboard.type('X')
  const text = await source.textContent()
  expect(text).toBe('X' + fullTextBefore!.slice(selectionBefore.text.length))
  await expect(alphaTab.locator('.tab-dirty')).toBeVisible()
})

test('US1 the choice persists across a restart', async () => {
  await openSourceView('alpha.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)

  const configPath = path.join(configDir, 'config.json')
  await expect
    .poll(() => {
      if (!fs.existsSync(configPath)) return undefined
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.wordWrap
    })
    .toBe(true)

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(false)
  // The restored state is visible on the toggle itself.
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'true')
})

test('FR-012 a malformed stored value falls back to disabled quietly', async () => {
  await closeAppSafely(app)
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ settings: { sidebarWidth: 44, wordWrap: 'on' } })
  )
  ;({ app, window } = await launchApp(configDir, testFolder))

  await openSourceView('alpha.md')
  await expect.poll(sourceOverflows).toBe(true)
  await expect(wordWrapToggle()).toHaveAttribute('aria-pressed', 'false')
})

test('FR-014 the visual editor never gains horizontal scrolling from wrap', async () => {
  await openSourceView('alpha.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)

  await window.getByRole('button', { name: 'Back to visual editing' }).click()
  await expect(window.getByTestId('source-view')).toHaveCount(0)

  const overflows = await window
    .locator('.milkdown')
    .first()
    .evaluate((el) => {
      return el.scrollWidth > el.clientWidth + 1
    })
  expect(overflows).toBe(false)
})

test('SC-005 typing into a large wrapped document stays responsive', async () => {
  const lines: string[] = []
  for (let i = 0; i < 10000; i++) lines.push(`line ${i} with some prose text`)
  fs.writeFileSync(path.join(testFolder, 'huge.md'), lines.join('\n') + '\n')

  await openSourceView('huge.md')
  await toggleWordWrap()
  await expect.poll(sourceOverflows).toBe(false)

  const source = window.getByTestId('source-textarea')
  await source.click()
  await window.keyboard.press('Control+Home')
  const started = Date.now()
  await window.keyboard.type('WRAPPED ', { delay: 10 })
  const elapsed = Date.now() - started
  await expect(source).toContainText('WRAPPED')
  // Ten keystrokes through a wrapped 10k-line buffer; a ceiling far below this
  // proved flaky under CI load, but anything perceptible per keystroke still
  // fails it decisively.
  expect(elapsed).toBeLessThan(3000)
})
