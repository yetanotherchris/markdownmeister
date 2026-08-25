import { test, expect, ElectronApplication, Page } from '@playwright/test'
import type { Locator } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile, openSettingsDialog, openThemeArea } from './launch'

/**
 * Spec 028 suite (contracts/renderer.md): two carry-over visual fixes.
 *
 * US1 (FR-001/002/003), the theme's canvas colour fills the whole editor
 * region, edge to edge, for short and long documents, across preset and custom
 * themes, in both light and dark modes. The checks compare the editor height
 * and its bottom color with the selected canvas color.
 *
 * US2 (FR-004/005/006), the view-source action uses the code-bracket-square
 * glyph in `--mm-view-source` dark blue,
 * in both the editor top bar and the explorer context menu.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-visual-fixes-ws-'))
  fs.writeFileSync(path.join(testFolder, 'short.md'), '# Short\n')
  fs.writeFileSync(path.join(testFolder, 'empty.md'), '')
  fs.writeFileSync(path.join(testFolder, 'single.md'), 'x')
  fs.writeFileSync(
    path.join(testFolder, 'long.md'),
    Array.from(
      { length: 80 },
      (_, i) => `Line ${i} with enough body text to fill the editor.`
    ).join('\n')
  )
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-visual-fixes-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

/** The 24px code-bracket-square outline path. */
const CODE_BRACKET_SQUARE_D =
  'M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z'

/** Stage an editor theme through the dropdown (spec 047). */
async function chooseEditorTheme(dialog: Page, theme: string): Promise<void> {
  await dialog.getByTestId('editor-theme').selectOption(theme)
}

/** The dark-blue token. */
async function viewSourceColour(): Promise<string> {
  return window.evaluate(() => {
    const root = document.querySelector('.app-container') as Element
    const probe = document.createElement('span')
    probe.style.color = 'var(--mm-view-source)'
    root.appendChild(probe)
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  })
}

/** The app accent token (for the "distinct from accent" assertion). */
async function accentColour(): Promise<string> {
  return window.evaluate(() => {
    const root = document.querySelector('.app-container') as Element
    const probe = document.createElement('span')
    probe.style.color = 'var(--mm-accent)'
    root.appendChild(probe)
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  })
}

/** The computed background colour of the Crepe root (the canvas colour). */
async function canvasColour(): Promise<string> {
  return window.locator('.milkdown').evaluate((el) => getComputedStyle(el).backgroundColor)
}

/**
 * The effective background colour at the bottom-centre of the editor area.
 * Walks up from the hit-tested element until a non-transparent background is
 * found, proving no wrong-colour patch is painted below the content.
 */
async function editorColourAtBottom(): Promise<string> {
  return window.evaluate(() => {
    const area = document.querySelector('.editor-area') as HTMLElement | null
    if (!area) return ''
    const rect = area.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 2)
    let node: Element | null = el
    while (node) {
      const bg = getComputedStyle(node).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
      node = node.parentElement
    }
    return ''
  })
}

/** The `.milkdown` height relative to the `.editor-host` height (fill ratio). */
async function canvasFillRatio(): Promise<number> {
  return window.evaluate(() => {
    const host = document.querySelector('.editor-host') as HTMLElement | null
    const canvas = host?.querySelector('.milkdown') as HTMLElement | null
    if (!host || !canvas) return 0
    return canvas.getBoundingClientRect().height / host.getBoundingClientRect().height
  })
}

/** Scroll the editor host to the bottom. */
async function scrollEditorToBottom(): Promise<void> {
  await window.locator('.editor-host').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
}

/** The View source button, the last top-bar item in the inner bar. */
function viewSourceButton(): Locator {
  return window.locator('.milkdown-top-bar .top-bar-inner > .top-bar-item').last()
}

/** The path `d` of a button's icon SVG. */
async function iconPath(button: Locator): Promise<string | null> {
  return button.locator('svg path').evaluate((p) => p.getAttribute('d'))
}

/** The computed `color` of a button's icon SVG. */
async function iconColor(button: Locator): Promise<string> {
  return button.locator('svg').evaluate((svg) => getComputedStyle(svg).color)
}

// ---------- US1: full-height canvas ----------

test('US1 a short document fills the editor with the theme canvas colour', async () => {
  await openFile(window, 'short.md')

  // FR-001: the Crepe root stretches to the full host height (no patch below).
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
  // The canvas is the Rustic cream and the bottom of the editor area shows it.
  await expect.poll(canvasColour).toBe('rgb(253, 246, 227)') // #fdf6e3
  await expect.poll(editorColourAtBottom).toBe('rgb(253, 246, 227)')
})

test('US1 changing the editor theme re-paints the full-height canvas (no residual patch)', async () => {
  await openFile(window, 'short.md')
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)

  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await chooseEditorTheme(dialog, 'scholarly')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  // The full region updates to the new canvas colour, edge to edge.
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'scholarly')
  await expect.poll(canvasColour).toBe('rgb(255, 255, 255)')
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
  await expect.poll(editorColourAtBottom).toBe('rgb(255, 255, 255)')
})

test('US1 a long document scrolled to the bottom keeps the canvas colour behind the content', async () => {
  await openFile(window, 'long.md')

  // The canvas fills the host (taller than the viewport) and rides behind the
  // content when scrolled, the bottom of the editor still shows the canvas
  // colour, no chrome band.
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(1)
  await scrollEditorToBottom()
  await expect.poll(editorColourAtBottom).toBe('rgb(253, 246, 227)')
})

test('US1 dark mode + Monotone fills the editor with the dark canvas colour', async () => {
  await openFile(window, 'short.md')

  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check()
  await chooseEditorTheme(dialog, 'monotone')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark')
  await expect(window.locator('.app-container')).toHaveAttribute('data-editor-theme', 'monotone')
  await expect.poll(canvasColour).toBe('rgb(0, 0, 0)')
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
  await expect.poll(editorColourAtBottom).toBe('rgb(0, 0, 0)')
})

test('US1 a custom theme fills the editor with its canvas colour', async () => {
  // Spec 036: a pre-upgrade spec-023 fixture migrates at startup, its stored
  // colours become migrated-custom.json and the selection repairs to it, so
  // the canvas paints exactly the stored colours.
  await closeAppSafely(app)
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({
      settings: {
        editorTheme: 'rustic',
        editorFont: 'serif',
        editorColors: {
          background: '#2b2b2b',
          foreground: '#e6e6e6',
          accent: '#3794ff',
          surface: '#1f1f1f',
          outline: '#6e6e6e',
          code: '#ff9d00'
        }
      }
    }),
    'utf-8'
  )
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'short.md')

  await expect(window.locator('.app-container')).toHaveAttribute(
    'data-editor-theme',
    'migrated-custom'
  )
  await expect
    .poll(() =>
      window
        .locator('.milkdown')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--crepe-color-background').trim())
    )
    .toBe('#2b2b2b')
  await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
  await expect.poll(editorColourAtBottom).toBe('rgb(43, 43, 43)')
})

test('US1 zero-content and single-character documents still fill the editor', async () => {
  // Spec edge cases: no content at all, and a single character.
  for (const name of ['empty.md', 'single.md'] as const) {
    await closeAppSafely(app)
    ;({ app, window } = await launchApp(configDir, testFolder))
    await openFile(window, name)
    await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
    await expect.poll(editorColourAtBottom).toBe('rgb(253, 246, 227)')
  }
})

test('US1 every preset theme fills the editor with its own canvas colour', async () => {
  // SC-001: the full-height behaviour holds across all five preset themes. Open
  // the dialog, select each theme, Save, and verify the canvas fills and paints
  // the theme's canvas value.
  await openFile(window, 'short.md')

  const themes: { name: string; canvas: string }[] = [
    { name: 'rustic', canvas: 'rgb(253, 246, 227)' },
    { name: 'rustic-serif', canvas: 'rgb(253, 246, 227)' },
    { name: 'scholarly', canvas: 'rgb(255, 255, 255)' },
    { name: 'monotone', canvas: 'rgb(255, 255, 255)' }, // light app theme
    { name: 'monotone-serif', canvas: 'rgb(255, 255, 255)' } // light app theme
  ]

  for (const theme of themes) {
    const dialog = await openSettingsDialog(window)
    await openThemeArea(window)
    await chooseEditorTheme(dialog, theme.name)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

    await expect.poll(canvasColour).toBe(theme.canvas)
    await expect.poll(canvasFillRatio).toBeGreaterThanOrEqual(0.99)
    await expect.poll(editorColourAtBottom).toBe(theme.canvas)
  }
})

// ---------- US2: dark-blue code-bracket-square view-source ----------

test('US2 the top-bar view-source glyph is the code-bracket-square in the dark blue', async () => {
  await openFile(window, 'short.md')
  const viewSource = viewSourceButton()
  await expect(viewSource).toBeVisible()

  // The glyph uses the expected code-bracket-square path.
  expect(await iconPath(viewSource)).toBe(CODE_BRACKET_SQUARE_D)

  // FR-005/FR-006: rendered in the curated dark blue, distinct from the accent.
  const expected = await viewSourceColour()
  expect(await iconColor(viewSource)).toBe(expected)
  expect(expected).not.toBe(await accentColour())
})

test('US2 the top-bar view-source glyph stays the dark blue in dark mode', async () => {
  await openFile(window, 'short.md')

  const dialog = await openSettingsDialog(window)
  await openThemeArea(window)
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check()
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark')

  // The single curated colour is identical in both modes (FR-005/006), it does
  // not follow the accent, which differs between light and dark.
  const viewSource = viewSourceButton()
  await expect(viewSource).toBeVisible()
  expect(await iconPath(viewSource)).toBe(CODE_BRACKET_SQUARE_D)
  const expected = await viewSourceColour()
  expect(await iconColor(viewSource)).toBe(expected)
  expect(expected).not.toBe(await accentColour())
})

test('US2 the explorer context-menu View source item is a plain text label', async () => {
  await openFile(window, 'short.md')

  await window.getByRole('treeitem').getByText('short.md').click({ button: 'right' })
  const item = window.getByRole('menuitem', { name: 'View source' })
  await expect(item).toBeVisible()

  // The context-menu action is a plain text item, no glyph. The code-bracket-
  // square dark-blue icon lives only in the editor top bar (spec 028 follow-up
  // 2026-08-10).
  await expect(item.locator('svg')).toHaveCount(0)
  await expect(item).toHaveText('View source')
})
