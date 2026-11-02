import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { meetsVersionFloor } from '../helpers/browser-version'
import { launchApp, closeAppSafely } from './launch'

let app: ElectronApplication | undefined
let page: Page
let directory: string

test.beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'mm-browser-security-'))
  const launched = await launchApp(join(directory, 'config'), undefined, join(directory, 'profile'))
  app = launched.app
  page = launched.window
})

test.afterEach(async () => {
  await closeAppSafely(app)
  app = undefined
  rmSync(directory, { recursive: true, force: true })
})

test('the built app uses patched browser and host runtimes', async () => {
  if (!app) throw new Error('The application did not start')
  const runtime = await app.evaluate(() => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))
  expect(meetsVersionFloor(runtime.electron, '43.8.6'), runtime.electron).toBe(true)
  expect(meetsVersionFloor(runtime.chrome, '150.0.7871.250'), runtime.chrome).toBe(true)
  expect(meetsVersionFloor(runtime.node, '24.22.1'), runtime.node).toBe(true)
})

test('the updated runtime retains renderer isolation and denies popups', async () => {
  if (!app) throw new Error('The application did not start')
  const preferences = await app.evaluate(({ BrowserWindow }) => {
    const settings = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
    return {
      contextIsolation: settings.contextIsolation,
      nodeIntegration: settings.nodeIntegration,
      sandbox: settings.sandbox
    }
  })
  expect(preferences).toEqual({ contextIsolation: true, nodeIntegration: false, sandbox: true })
  expect(await page.evaluate(() => ({ process: typeof process, require: typeof require }))).toEqual(
    {
      process: 'undefined',
      require: 'undefined'
    }
  )
  expect(await page.evaluate(() => window.open('about:blank') === null)).toBe(true)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
})
