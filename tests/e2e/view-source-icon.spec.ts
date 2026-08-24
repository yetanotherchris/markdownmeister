import { test, expect, ElectronApplication, Page } from '@playwright/test'
import type { Locator } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile, openSettingsDialog, openThemeArea } from './launch'

/**
 * Spec 014 suite (contracts/renderer.md): the View source action is the last
 * `.top-bar-item` in the editor toolbar. Its code-bracket-square glyph uses
 * `--mm-view-source` dark blue in both modes. The checks cover position,
 * labels, color distinction, and dark mode.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-view-source-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  // Isolated per-test config so a theme change can never touch the developer's
  // real config (MM_CONFIG_DIR seam, spec 019 R6).
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-view-source-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
  await openFile(window, 'alpha.md')
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

/** The View source button, the last top-bar item in the inner bar. */
function viewSourceButton(): Locator {
  return window.locator('.milkdown-top-bar .top-bar-inner > .top-bar-item').last()
}

/** The first formatting control (Bold), the "ordinary" icon to compare against. */
function boldButton(): Locator {
  return window.locator('.milkdown-top-bar .top-bar-inner > .top-bar-item').first()
}

/** Resolve the spec-028 dark-blue token to its computed rgb colour. */
async function viewSourceColor(): Promise<string> {
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

/** Resolve the app accent token to its computed rgb colour. */
async function accentColor(): Promise<string> {
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

/** The computed `color` of a button's icon SVG. */
async function iconColor(button: Locator): Promise<string> {
  return button.locator('svg').evaluate((svg) => getComputedStyle(svg).color)
}

/** The path `d` of a button's icon SVG. */
async function iconPath(button: Locator): Promise<string | null> {
  return button.locator('svg path').evaluate((p) => p.getAttribute('d'))
}

test('US1/US2 the View source icon is the dark-blue last toolbar item', async () => {
  const viewSource = viewSourceButton()
  await expect(viewSource).toBeVisible()

  // FR-004: the label pipeline (toolbarLabels.ts) keeps the tooltip intact.
  await expect(viewSource).toHaveAttribute('title', 'View source')
  await expect(viewSource).toHaveAttribute('aria-label', 'View source')

  // FR-006 + FR-001: it is the LAST control in the inner bar.
  const isLast = await viewSource.evaluate((el) => el === el.parentElement?.lastElementChild)
  expect(isLast).toBe(true)

  // The glyph uses the expected code-bracket-square path.
  expect(await iconPath(viewSource)).toBe(CODE_BRACKET_SQUARE_D)

  // FR-001/FR-003: its icon renders in the curated dark blue, distinct from the
  // accent token; Bold stays muted outline.
  const viewSourceColorValue = await viewSourceColor()
  expect(await iconColor(viewSource)).toBe(viewSourceColorValue)
  expect(viewSourceColorValue).not.toBe(await accentColor())
  expect(await iconColor(boldButton())).not.toBe(viewSourceColorValue)
})

test('FR-005 the icon stays distinct and dark-blue in the dark theme', async () => {
  // Capture the light token value before switching themes.
  const lightViewSource = await viewSourceColor()

  // Choose the Dark theme override (deterministic; matches US2 of spec 013).
  await openSettingsDialog(window)
  await openThemeArea(window)
  await window.getByRole('radio', { name: 'Dark', exact: true }).check()
  await expect(window.locator('.app-container')).toHaveAttribute('data-theme', 'dark')

  const viewSource = viewSourceButton()
  await expect(viewSource).toBeVisible()

  // Spec 028 (FR-005/006): the view-source colour is a SINGLE curated colour,
  // identical in both modes and does not follow the accent.
  const viewSourceColorValue = await viewSourceColor()
  expect(viewSourceColorValue).toBe(lightViewSource)
  expect(await iconColor(viewSource)).toBe(viewSourceColorValue)
  expect(viewSourceColorValue).not.toBe(await accentColor())
  expect(await iconColor(boldButton())).not.toBe(viewSourceColorValue)
})
