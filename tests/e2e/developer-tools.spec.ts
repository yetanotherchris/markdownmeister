import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openHamburger, openSettingsDialog, pressShortcut } from './launch'

/**
 * Spec 008 (clarification 2026-08-08): developer tools are always available via
 * the F12 / Ctrl/Cmd+Shift+I keyboard shortcuts. There is no settings entry and
 * no hamburger item. The shortcuts are injected with `sendInputEvent` (launch.ts
 * `pressShortcut`) because Playwright's CDP keyboard events do not reach the
 * main-process `before-input-event` handler; DevTools state is read from the
 * real BrowserWindow via `electronApp.evaluate`.
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-devtools-e2e-'))
  fs.writeFileSync(path.join(testFolder, 'alpha.md'), '# Alpha\n\nHello world.')
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-devtools-cfg-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

async function devtoolsOpen(): Promise<boolean> {
  return app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    return w.webContents.isDevToolsOpened()
  })
}

test('F12 toggles developer tools unconditionally (no setting required)', async () => {
  expect(await devtoolsOpen()).toBe(false)

  await pressShortcut(app, 'F12')
  await expect.poll(devtoolsOpen).toBe(true)

  // Toggle again: it closes.
  await pressShortcut(app, 'F12')
  await expect.poll(devtoolsOpen).toBe(false)
})

test('Ctrl/Cmd+Shift+I toggles developer tools unconditionally', async () => {
  expect(await devtoolsOpen()).toBe(false)

  await pressShortcut(app, 'i', ['control', 'shift'])
  await expect.poll(devtoolsOpen).toBe(true)

  await pressShortcut(app, 'i', ['control', 'shift'])
  await expect.poll(devtoolsOpen).toBe(false)
})

test('the settings dialog has no developer-tools control', async () => {
  await openSettingsDialog(window)
  const box = window.getByTestId('settings-dialog')
  await expect(box.getByRole('checkbox', { name: 'Enable developer tools' })).toHaveCount(0)
})

test('the hamburger menu has no Toggle Developer Tools item', async () => {
  await openHamburger(window)
  await expect(window.getByRole('menuitem', { name: 'Toggle Developer Tools' })).toHaveCount(0)
})
