import { test, expect, ElectronApplication } from '@playwright/test'
import { launchApp, closeAppSafely } from './launch'

/**
 * Spec 039: the running window carries the product icon (US1 "running
 * window/taskbar"). The assertion runs in main via `app.evaluate` because the
 * BrowserWindow icon is a main-process property; getIcon() reflects the
 * constructor option on win32/Linux (macOS takes the bundle icns instead).
 *
 * Honest scope note: this proves the wiring only. How the OS shell renders the
 * icon on real taskbars/Docks/installer surfaces is manual verification
 * (quickstart.md) — Playwright cannot see those.
 */

let app: ElectronApplication

test.beforeEach(async () => {
  ;({ app } = await launchApp())
})

test.afterEach(async () => {
  await closeAppSafely(app)
})

test('main window exposes a non-null product icon with sane dimensions', async () => {
  const size = await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows()[0]
    if (!main.getIcon) return null
    return main.getIcon().getSize()
  })
  expect(size).not.toBeNull()
  if (!size) return
  expect(size.width).toBeGreaterThan(0)
  expect(size.height).toBeGreaterThan(0)
})
