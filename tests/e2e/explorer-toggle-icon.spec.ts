import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { closeAppSafely, launchApp, openFile, openFolder, typeInEditor } from './launch'

/**
 * Spec 068: the file-explorer toggle draws one outlined window with a narrow
 * left pane. The button, its name, and the hide/restore behaviour stay as they
 * were.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-icon-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-explorer-icon-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

const toggle = () => window.getByRole('button', { name: 'Toggle file explorer' })
const menu = () => window.getByRole('button', { name: 'Open menu' })
const sidebarWidth = () =>
  window.locator('.sidebar-panel').evaluate((el) => el.getBoundingClientRect().width)

interface Glyph {
  childCount: number
  rectCount: number
  pathCount: number
  x: number
  y: number
  width: number
  height: number
  rx: number
  paths: string[]
  fill: string | null
  rectFill: string | null
  pathFill: string | null
  pathStroke: string | null
  strokeWidth: string | null
  viewBox: string | null
  className: string
}

interface Paint {
  menuStroke: string
  toggleStroke: string
  toggleColor: string
  headerBg: string
  buttonBg: string
}

async function readGlyph(svg: Locator): Promise<Glyph> {
  return svg.evaluate((el) => {
    const rect = el.querySelector('rect')
    const path = el.querySelector('path')
    return {
      childCount: el.childElementCount,
      rectCount: el.querySelectorAll('rect').length,
      pathCount: el.querySelectorAll('path').length,
      x: Number(rect?.getAttribute('x')),
      y: Number(rect?.getAttribute('y')),
      width: Number(rect?.getAttribute('width')),
      height: Number(rect?.getAttribute('height')),
      rx: Number(rect?.getAttribute('rx')),
      paths: [...el.querySelectorAll('path')].map((p) => p.getAttribute('d') ?? ''),
      fill: el.getAttribute('fill'),
      rectFill: rect?.getAttribute('fill') ?? null,
      pathFill: path?.getAttribute('fill') ?? null,
      pathStroke: path?.getAttribute('stroke') ?? null,
      strokeWidth: el.getAttribute('stroke-width'),
      viewBox: el.getAttribute('viewBox'),
      className: el.getAttribute('class') ?? ''
    }
  })
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function contrast(foreground: string, background: string): number {
  const parse = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) throw new Error(`unparsed color ${color}`)
    return [Number(match[1]), Number(match[2]), Number(match[3])]
  }
  const luminance = (color: string) => {
    const [r, g, b] = parse(color)
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const hi = Math.max(luminance(foreground), luminance(background))
  const lo = Math.min(luminance(foreground), luminance(background))
  return (hi + 0.05) / (lo + 0.05)
}

function expectLeftSidebar(glyph: Glyph): void {
  expect(glyph.childCount).toBe(2)
  expect(glyph.rectCount).toBe(1)
  expect(glyph.pathCount).toBe(1)
  expect(glyph.paths).toEqual(['M9 3v18'])
  expect(glyph.className).toContain('lucide-panel-left')
  expect(glyph.className).toContain('chrome-icon')
  expect(glyph.viewBox).toBe('0 0 24 24')
  expect(glyph.x).toBe(3)
  expect(glyph.y).toBe(3)
  expect(glyph.width).toBe(18)
  expect(glyph.height).toBe(18)
  expect(glyph.rx).toBe(2)
  const parsed = /^M(-?\d+(?:\.\d+)?)\s/.exec(glyph.paths[0] ?? '')
  expect(parsed).not.toBeNull()
  const dividerX = Number(parsed![1])
  const center = glyph.x + glyph.width / 2
  const right = glyph.x + glyph.width
  expect(dividerX).toBeLessThan(center)
  expect(dividerX - glyph.x).toBeLessThan(right - dividerX)
  expect(glyph.fill).toBe('none')
  expect(glyph.rectFill).toBeNull()
  expect(glyph.pathFill).toBeNull()
  expect(glyph.pathStroke).toBeNull()
  expect(glyph.strokeWidth).toBe('1.5')
}

async function readPaint(): Promise<Paint> {
  const paint = await window.locator('.header-bar').evaluate((header) => {
    const menuSvg = header.querySelector('button[aria-label="Open menu"] svg')
    const toggleSvg = header.querySelector('button[aria-label="Toggle file explorer"] svg')
    const toggleButton = header.querySelector('button[aria-label="Toggle file explorer"]')
    if (!menuSvg || !toggleSvg || !toggleButton) return null
    return {
      menuStroke: getComputedStyle(menuSvg).stroke,
      toggleStroke: getComputedStyle(toggleSvg).stroke,
      toggleColor: getComputedStyle(toggleButton).color,
      headerBg: getComputedStyle(header).backgroundColor,
      buttonBg: getComputedStyle(toggleButton).backgroundColor
    }
  })
  expect(paint).not.toBeNull()
  return paint!
}

async function expectSameBox(a: Locator, b: Locator): Promise<void> {
  const boxA = await a.boundingBox()
  const boxB = await b.boundingBox()
  expect(boxA).not.toBeNull()
  expect(boxB).not.toBeNull()
  expect(Math.abs(boxA!.width - boxB!.width)).toBeLessThan(1)
  expect(Math.abs(boxA!.height - boxB!.height)).toBeLessThan(1)
  expect(Math.abs(boxA!.y - boxB!.y)).toBeLessThan(1)
}

test('the toggle draws a narrow left pane and keeps that symbol while hidden', async () => {
  await openFolder(window)
  const svg = toggle().locator('svg')
  await expect(svg).toHaveClass(/chrome-icon/)
  await expect(svg).toHaveClass(/lucide-panel-left/)
  expectLeftSidebar(await readGlyph(svg))

  await toggle().click()
  await expect.poll(sidebarWidth).toBeLessThan(3)
  expectLeftSidebar(await readGlyph(svg))

  await toggle().click()
  await expect.poll(sidebarWidth).toBeGreaterThan(50)
  expectLeftSidebar(await readGlyph(svg))
})

test('with no workspace the toggle is disabled and still shows the left pane', async () => {
  for (const scheme of ['light', 'dark'] as const) {
    await window.emulateMedia({ colorScheme: scheme })
    await expect(window.locator('.app-container')).toHaveAttribute('data-theme', scheme)
    await expect(toggle()).toBeDisabled()
    await expect(toggle()).toHaveAttribute('title', 'Toggle file explorer')
    await expect(toggle()).toHaveAttribute('aria-label', 'Toggle file explorer')
    const opacity = await toggle().evaluate((el) => getComputedStyle(el).opacity)
    expect(opacity).toBe('0.6')
    const paint = await readPaint()
    expect(paint.toggleStroke).toBe(paint.toggleColor)
    expect(paint.toggleStroke).not.toBe(paint.menuStroke)
    expectLeftSidebar(await readGlyph(toggle().locator('svg')))
  }
})

test('the symbol matches the menu icon in light and dark', async () => {
  // The toggle is disabled until a workspace is open, so compare it with the
  // menu button only after both controls use the enabled color.
  await openFolder(window)
  const strokes: string[] = []
  for (const scheme of ['light', 'dark'] as const) {
    await window.mouse.move(0, 0)
    await window.emulateMedia({ colorScheme: scheme })
    await expect(window.locator('.app-container')).toHaveAttribute('data-theme', scheme)

    const paint = await readPaint()
    expect(paint.toggleStroke).toBe(paint.toggleColor)
    expect(paint.toggleStroke).toBe(paint.menuStroke)
    expect(contrast(paint.toggleStroke, paint.headerBg)).toBeGreaterThanOrEqual(3)
    strokes.push(paint.toggleStroke)
    expectLeftSidebar(await readGlyph(toggle().locator('svg')))

    const restingBackground = paint.buttonBg
    await toggle().hover()
    const hovered = await readPaint()
    expect(hovered.buttonBg).not.toBe(restingBackground)
    expect(contrast(hovered.toggleStroke, hovered.buttonBg)).toBeGreaterThanOrEqual(3)
    expectLeftSidebar(await readGlyph(toggle().locator('svg')))

    await expectSameBox(toggle(), menu())
    await expectSameBox(toggle().locator('svg'), menu().locator('svg'))
  }

  expect(strokes[0]).not.toBe(strokes[1])
})

test('the name, hover, and keyboard activation stay on the same control', async () => {
  await openFolder(window)
  await expect(toggle()).toHaveAttribute('title', 'Toggle file explorer')

  const resting = await toggle().evaluate((el) => getComputedStyle(el).backgroundColor)
  await toggle().hover()
  const hovered = await toggle().evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(hovered).not.toBe(resting)
  expectLeftSidebar(await readGlyph(toggle().locator('svg')))

  // Programmatic focus does not match :focus-visible. Tab from the menu button does.
  await menu().focus()
  await window.keyboard.press('Tab')
  const focused = await window.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return null
    const style = getComputedStyle(el)
    return {
      label: el.getAttribute('aria-label'),
      ring: style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
    }
  })
  expect(focused).toEqual({ label: 'Toggle file explorer', ring: true })

  await window.keyboard.press('Enter')
  await expect.poll(sidebarWidth).toBeLessThan(3)
  await window.keyboard.press('Enter')
  await expect.poll(sidebarWidth).toBeGreaterThan(50)
  expectLeftSidebar(await readGlyph(toggle().locator('svg')))
})

test('hiding the explorer leaves an unsaved document untouched', async () => {
  await openFile(window, 'alpha.md')
  await typeInEditor(window, ' EXTRA')
  const tab = window.getByRole('tab', { name: /alpha\.md/ })
  const editor = window.locator('.ProseMirror:visible')
  const before = await editor.innerText()
  const onDisk = fs.readFileSync(path.join(testFolder, 'alpha.md'), 'utf8')
  await expect(tab.locator('.tab-dirty')).toBeVisible()
  expect(before).toContain('EXTRA')

  await toggle().click()
  await expect.poll(sidebarWidth).toBeLessThan(3)
  await toggle().click()
  await expect.poll(sidebarWidth).toBeGreaterThan(50)

  expect(await editor.innerText()).toBe(before)
  expect(fs.readFileSync(path.join(testFolder, 'alpha.md'), 'utf8')).toBe(onDisk)
  await expect(tab.locator('.tab-dirty')).toBeVisible()
  expectLeftSidebar(await readGlyph(toggle().locator('svg')))
})
