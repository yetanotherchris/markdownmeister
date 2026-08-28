import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openHamburger, openSettingsDialog } from './launch'

/**
 * Spec 030 markdown syntax options suite (contracts/markdown-syntax.md §E2e +
 * quickstart): the Markdown settings area with six toggles (FR-001..FR-009),
 * immediate re-rendering on toggle (US1/US2), multi-tab sync with dirty/undo/
 * cursor preservation (US3), persistence + fresh-install defaults (US4,
 * FR-013), disabled-syntax save round-trip (SC-004), source-view immunity, and
 * unclosed-delimiter / rapid-toggle edge cases.
 */

const SCRATCH = [
  '~~struck~~ and $E=mc^2$ and https://example.com',
  '',
  '$$',
  '\\sum_{i=1}^{n} i',
  '$$',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '- [ ] todo',
  '- [x] done',
  '',
  'line one',
  'line two',
  '',
  '~not-closed $not-closed',
  ''
].join('\n')

const SECOND_FILE = '## Second\n\n~~also struck~~'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-md-syntax-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'syntax.md'), SCRATCH)
  fs.writeFileSync(path.join(testFolder, 'second.md'), SECOND_FILE)
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-md-syntax-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function openFolder(): Promise<void> {
  await openHamburger(window)
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await window.getByRole('button', { name: 'Open menu' }).focus()
  await expect(window.getByRole('treeitem').first()).toBeVisible()
}

async function openFile(): Promise<void> {
  await openFolder()
  await window.getByRole('treeitem').getByText('syntax.md').click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

/** Open Settings → Markdown, returning the settings dialog locator. */
async function openMarkdownArea(): Promise<ReturnType<Page['getByTestId']>> {
  await openSettingsDialog(window)
  const dialog = window.getByTestId('settings-dialog')
  await dialog.getByRole('button', { name: 'Markdown' }).click()
  // The native checkbox is visually hidden (pill switch); wait on the visible
  // label text instead.
  await expect(
    dialog.locator('.settings-switch-text', { hasText: 'Strikethrough formatting' })
  ).toBeVisible()
  return dialog
}

/** Toggle a Markdown-area switch by its accessible label. */
async function toggle(dialog: ReturnType<Page['getByTestId']>, label: RegExp): Promise<void> {
  await dialog.locator('.settings-switch', { hasText: label }).click()
}

async function persistedSetting<T>(key: string): Promise<T | undefined> {
  const configPath = path.join(configDir, 'config.json')
  if (!fs.existsSync(configPath)) return undefined
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')).settings?.[key]
}

test('US1 the Markdown area lists six independent switches with FR-013 defaults', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  const box = dialog

  await expect(
    box.getByRole('checkbox', { name: /Convert single line breaks to hard breaks/ })
  ).not.toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Strikethrough formatting/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Tables formatting/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Task list checkboxes/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Math and LaTeX expressions/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Automatic link detection/ })).toBeChecked()
})

test('US1 toggling strikethrough off renders tildes as literal text, on renders a strike line', async () => {
  await openFile()
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(1)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)

  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('~~struck~~')
})

test('US1 toggling math off renders dollar signs as literal text', async () => {
  await openFile()
  await expect(window.locator('.ProseMirror:visible [data-type="math_inline"]')).toHaveCount(1)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Math and LaTeX expressions/)

  await expect(window.locator('.ProseMirror:visible [data-type="math_inline"]')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('$E=mc^2$')
})

test('US1 toggling tables off renders pipe lines as literal text', async () => {
  await openFile()
  // A rendered table has no literal pipe delimiters.
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('| a | b |')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Tables formatting/)

  await expect(window.locator('.ProseMirror:visible')).toContainText('| a | b |')
})

test('US1 toggling task lists off renders brackets as literal list text', async () => {
  await openFile()
  // Task syntax consumes the `[ ]` marker (renders a checkbox icon).
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('[ ] todo')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Task list checkboxes/)

  await expect(window.locator('.ProseMirror:visible')).toContainText('[ ] todo')
})

test('US1 with autolink disabled, a bare URL stays plain text on load', async () => {
  await closeAppSafely(app)
  // Seed only after the previous instance is gone: a live app's debounced
  // settings write would otherwise flush over this file after the seed.
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ settings: { autolink: false } }),
    'utf-8'
  )
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()

  await expect(window.locator('.ProseMirror:visible a[href="https://example.com"]')).toHaveCount(0)
  await expect(window.locator('.ProseMirror:visible')).toContainText('https://example.com')
})

test('US2 toggling hard breaks re-flows single newlines', async () => {
  await openFile()
  // Soft breaks collapse into one wrapped paragraph (no <br>).
  await expect(window.locator('.ProseMirror:visible br')).toHaveCount(0)

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Convert single line breaks to hard breaks/)

  await expect(window.locator('.ProseMirror:visible br')).toHaveCount(1)
})

test('US3 toggling a setting preserves unsaved edits and dirty state across tabs', async () => {
  await openFile()
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' EXTRA')

  const tab = window.getByRole('tab', { name: /syntax\.md/ })
  await expect(tab.locator('.tab-dirty')).toBeVisible()

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)

  await expect(tab.locator('.tab-dirty')).toBeVisible()
  await expect(window.locator('.ProseMirror:visible')).toContainText('EXTRA')
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
})

test('US3 two open tabs both re-render on a toggle (2026-08-15 review fix)', async () => {
  // Contract §E2e multi-tab sync: every open tab re-renders on a toggle, not
  // just the active one. Open two documents, dirty the second, then toggle.
  await openFile()
  // A single click on a clean active tab REPLACES it (spec 024 FR-005), so open
  // the second file in a new tab via middle-click.
  await window.getByRole('treeitem').getByText('second.md').click({ button: 'middle' })
  await expect(window.getByRole('tab')).toHaveCount(2)

  // Make the active (second) tab dirty with an unsaved edit.
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' EXTRA')
  const secondTab = window.getByRole('tab', { name: /second\.md/ })
  await expect(secondTab.locator('.tab-dirty')).toBeVisible()

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)

  // The dirty dot and the unsaved edit survive the toggle...
  await expect(secondTab.locator('.tab-dirty')).toBeVisible()
  await expect(window.locator('.ProseMirror:visible')).toContainText('EXTRA')
  // ...and BOTH tabs re-rendered: strike text is gone from the active second
  // tab and from the background syntax.md tab.
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)

  const firstTab = window.getByRole('tab', { name: /syntax\.md/ })
  // Close the dialog so its overlay does not intercept the tab click.
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
  await firstTab.click()
  await expect(window.locator('.ProseMirror:visible')).toContainText('~~struck~~')
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
})

test('US4 markdown settings persist across a restart', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)
  await expect.poll(() => persistedSetting<boolean>('strikethrough')).toBe(false)
  await expect.poll(() => persistedSetting<boolean>('math')).toBe(false)

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)

  const reopened = await openMarkdownArea()
  await expect(
    reopened.getByRole('checkbox', { name: /Strikethrough formatting/ })
  ).not.toBeChecked()
  await expect(
    reopened.getByRole('checkbox', { name: /Math and LaTeX expressions/ })
  ).not.toBeChecked()
})

test('US4 a fresh install gets FR-013 defaults (all on, hard breaks off)', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await expect(dialog.getByRole('checkbox', { name: /Strikethrough formatting/ })).toBeChecked()
  await expect(
    dialog.getByRole('checkbox', { name: /Convert single line breaks to hard breaks/ })
  ).not.toBeChecked()
})

test('visual code highlighting defaults on, toggles without dirtying, and persists across restart', async () => {
  await openFile()
  const tab = window.getByRole('tab', { name: /syntax\.md/ })
  const dialog = await openMarkdownArea()
  const setting = dialog.getByRole('checkbox', { name: /Syntax highlight code blocks/ })

  await expect(setting).toBeChecked()
  await expect(window.locator('.app-container')).toHaveAttribute(
    'data-visual-code-highlighting',
    'on'
  )
  await expect(tab.locator('.tab-dirty')).toHaveCount(0)

  await dialog.locator('.settings-switch', { hasText: /Syntax highlight code blocks/ }).click()
  await expect(window.locator('.app-container')).toHaveAttribute(
    'data-visual-code-highlighting',
    'off'
  )
  await expect(tab.locator('.tab-dirty')).toHaveCount(0)
  await expect.poll(() => persistedSetting<boolean>('visualCodeHighlighting')).toBe(false)

  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await expect(window.locator('.app-container')).toHaveAttribute(
    'data-visual-code-highlighting',
    'off'
  )
})

test('SC-004 disabling a syntax saves the exact raw source text', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Tables formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)

  // Close the dialog, make a real edit so the document is dirty, then save.
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' ')
  await window.keyboard.press('Control+s')

  // The disabled syntaxes (math `$` and pipe tables) save byte-for-byte.
  await expect
    .poll(() => fs.readFileSync(path.join(testFolder, 'syntax.md'), 'utf-8'))
    .toContain('$E=mc^2$')
  await expect
    .poll(() => fs.readFileSync(path.join(testFolder, 'syntax.md'), 'utf-8'))
    .toContain('| a | b |')
})

test('edge case: unclosed delimiters stay literal in both states', async () => {
  await openFile()
  // `~not-closed` and `$not-closed` are never valid markdown, so they stay
  // literal whether or not the surrounding syntaxes are enabled.
  await expect(window.locator('.ProseMirror:visible')).toContainText('~not-closed')
  await expect(window.locator('.ProseMirror:visible')).toContainText('$not-closed')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await toggle(dialog, /Math and LaTeX expressions/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await expect(window.locator('.ProseMirror:visible')).toContainText('~not-closed')
  await expect(window.locator('.ProseMirror:visible')).toContainText('$not-closed')
})

test('US3 undo/redo history survives a toggle, and a re-enable restores the rich element', async () => {
  await openFile()
  // Make a real edit so undo has a step to revisit.
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' EXTRA')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  // The edit made before toggling remains undoable.
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('Control+z')
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('EXTRA')

  // Re-enable: the still-present `~~struck~~` literal re-parses back to rich.
  const reopened = await openMarkdownArea()
  await toggle(reopened, /Strikethrough formatting/)
  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(1)
})

test('US3 a toggle preserves the cursor position in the active tab', async () => {
  await openFile()
  // Put the caret at the start of the "line one" paragraph, then read its
  // absolute document offset (walk the text nodes under the editor root so the
  // value is independent of DOM restructuring after the re-parse). The hard
  // breaks toggle keeps every text node identical (a soft-break newline and a
  // hard `<br>` both contribute no text), so the offset must survive unchanged.
  const editor = window.locator('.ProseMirror:visible')
  await editor.getByText('line one').click()
  await window.keyboard.press('Home')
  const docOffset = (): Promise<number> =>
    editor.evaluate((el) => {
      const sel = el.ownerDocument.getSelection()
      if (!sel?.anchorNode) return -1
      const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let offset = 0
      let node = walker.nextNode()
      while (node) {
        if (node === sel.anchorNode) return offset + sel.anchorOffset
        offset += node.textContent?.length ?? 0
        node = walker.nextNode()
      }
      return -1
    })
  const before = await docOffset()

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Convert single line breaks to hard breaks/)

  // The caret retains its absolute document offset after re-parsing.
  expect(await docOffset()).toBe(before)
})

test('US1 block math $$…$$ renders when enabled and stays literal when disabled', async () => {
  await openFile()
  // Enabled block math renders without literal delimiters.
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('$$')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Math and LaTeX expressions/)

  // Disabled, the block delimiters stay literal text (FR-014).
  await expect(window.locator('.ProseMirror:visible')).toContainText('$$')
})

test('US1 autolink enabled renders a bare URL as a link', async () => {
  await openFile()
  // FR-008 enabled: the bare URL in the fixture auto-links on load.
  await expect(window.locator('.ProseMirror:visible a[href="https://example.com"]')).toHaveCount(1)
})

test('SC-004 enabling a syntax present in the raw file does not rewrite it on save', async () => {
  // Pre-seed the config with the math syntax disabled, then enable it in the
  // dialog. The raw file still holds `$E=mc^2$`; saving must not rewrite it.
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ settings: { math: false } }),
    'utf-8'
  )
  await closeAppSafely(app)
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile()
  // Math off: the inline formula stays literal.
  await expect(window.locator('.ProseMirror:visible')).toContainText('$E=mc^2$')

  const dialog = await openMarkdownArea()
  await toggle(dialog, /Math and LaTeX expressions/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // Make a real edit, save, and verify the raw file still round-trips the
  // enabled syntax byte-for-byte (SC-004).
  await window.locator('.ProseMirror:visible').click()
  await window.keyboard.press('End')
  await window.keyboard.type(' ')
  await window.keyboard.press('Control+s')

  await expect
    .poll(() => fs.readFileSync(path.join(testFolder, 'syntax.md'), 'utf-8'))
    .toContain('$E=mc^2$')
})

test('edge case: source view is immune to markdown toggles', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  await toggle(dialog, /Strikethrough formatting/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // Switch to source view via the top-bar "View source" button.
  await window.locator('.milkdown-top-bar').getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-textarea')).toBeVisible()
  await expect(window.getByTestId('source-textarea')).toContainText('~~struck~~')
})

test('edge case: rapid toggling settles on the final state', async () => {
  await openFile()
  const dialog = await openMarkdownArea()
  const toggleSwitch = dialog.locator('.settings-switch', { hasText: /Strikethrough formatting/ })
  await toggleSwitch.click()
  await toggleSwitch.click()
  await toggleSwitch.click()

  await expect(window.locator('.ProseMirror:visible del')).toHaveCount(0)
  await expect(dialog.getByRole('checkbox', { name: /Strikethrough formatting/ })).not.toBeChecked()
})
