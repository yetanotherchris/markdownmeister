import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, stubTrash, openFolder as openWorkspaceFolder } from './launch'

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-source-scroll-e2e-'))
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

async function openFile(name: string): Promise<void> {
  await openWorkspaceFolder(window)
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

/** Scroll the formatted editor's scroll container, click in the visible prose,
 *  then toggle View source from the toolbar. */
async function scrollToAndToggle(scrollTop: number): Promise<void> {
  await window.evaluate((top) => {
    const host = document.querySelector('.editor-host:not(.has-source)') as HTMLElement
    host.scrollTop = top
  }, scrollTop)
  const hostBox = (await window.locator('.editor-host').first().boundingBox()) as {
    x: number
    y: number
    width: number
    height: number
  }
  await window.mouse.click(hostBox.x + hostBox.width / 2, hostBox.y + hostBox.height / 2)
  await window.getByRole('button', { name: 'View source' }).click()
  await expect(window.getByTestId('source-view')).toBeVisible()
}

test.describe('source view after scrolling the formatted editor', () => {
  test('entering source view resets the host scroll so the overlay covers the editor', async () => {
    const lines = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of the scroll document.`)
    fs.writeFileSync(path.join(testFolder, 'scroll.md'), lines.join('\n\n'))
    await openFile('scroll.md')

    await scrollToAndToggle(1000)

    // The overlay is anchored at the scroll container's content origin, so a
    // retained scrollTop pushes it out of the viewport and exposes the locked
    // ProseMirror underneath.
    const hostScroll = await window
      .locator('.editor-host.has-source')
      .evaluate((el) => el.scrollTop)
    expect(hostScroll).toBe(0)
  })

  test('the source surface receives clicks and input after a scrolled toggle', async () => {
    const lines = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of the scroll document.`)
    fs.writeFileSync(path.join(testFolder, 'scroll.md'), lines.join('\n\n'))
    await openFile('scroll.md')

    await scrollToAndToggle(1000)
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

  test('returning to formatted editing restores the pre-toggle scroll position', async () => {
    const lines = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of the scroll document.`)
    fs.writeFileSync(path.join(testFolder, 'scroll.md'), lines.join('\n\n'))
    await openFile('scroll.md')

    await scrollToAndToggle(1000)
    await window.getByRole('button', { name: /Back to visual editing/ }).click()
    await expect(window.getByTestId('source-view')).toHaveCount(0)

    const hostScroll = await window
      .locator('.editor-host:not(.has-source)')
      .evaluate((el) => el.scrollTop)
    expect(hostScroll).toBe(1000)
  })
})
