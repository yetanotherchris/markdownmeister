import { test, expect, chromium, type ElectronApplication, type Page } from '@playwright/test'
import type { BrowserType } from 'playwright-core'
import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openFolder } from './launch'

/**
 * Spec 038 (FR-004/FR-005): the MSIX execution alias delivers the chosen
 * folder as plain argv — the same channel the classic Explorer verb uses.
 * The suite cannot register an alias, so it reproduces the alias invocation
 * faithfully at the process level: the real Electron binary is SPAWNED with
 * the folder as its trailing argument (cold launch), and as a second process
 * holding the same profile (single-instance forwarding). Everything else —
 * extraction, validation, confirmation, routing — is the production code path.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const ELECTRON_BINARY = path.join(
  REPO_ROOT,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32'
    ? 'electron.exe'
    : process.platform === 'darwin'
      ? 'Electron.app/Contents/MacOS/Electron'
      : 'electron'
)

let spawned: ChildProcess[] = []
let dirs: string[] = []

function makeDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

interface SpawnedApp {
  browser: Awaited<ReturnType<BrowserType['connectOverCDP']>>
  page: Page
}

/** Spawn the real binary the way the OS would (argv carries the target) and
 *  attach over CDP using the endpoint Electron announces on stderr. */
async function spawnWithTarget(
  target: string | null,
  userDataDir: string,
  configDir: string
): Promise<SpawnedApp> {
  const args = ['--headless', '--remote-debugging-port=0', 'out/main/index.js']
  if (target) args.push(target)
  const child = spawn(ELECTRON_BINARY, args, {
    cwd: REPO_ROOT,
    detached: false,
    // stderr must be piped: it carries the "DevTools listening on ws://" line.
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      MM_USER_DATA_DIR: userDataDir,
      MM_CONFIG_DIR: configDir,
      // Production parity: single-instance lock ON (launch.ts disables it for
      // ordinary tests; here it IS the behaviour under test).
      MM_SINGLE_INSTANCE: '1'
    }
  })
  spawned.push(child)

  const endpoint = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no CDP endpoint announced')), 20_000)
    let stderrText = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      // Accumulate across chunks: the announced line can split mid-token at
      // any pipe boundary, so per-chunk matching would miss it.
      stderrText += chunk.toString()
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderrText)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    child.on('exit', () => {
      clearTimeout(timer)
      reject(new Error('spawned binary exited before announcing a CDP endpoint'))
    })
  })

  const browser = await chromium.connectOverCDP(endpoint)
  // connectOverCDP can land after the window exists but before navigation
  // commits, leaving the ALREADY-TRACKED renderer reporting about:blank — and
  // the `page` event fires only for targets added after connection, so
  // waiting on the event alone would deadlock. Poll pages() instead: a
  // deterministic wait that resolves under every attach timing.
  const context = browser.contexts()[0]
  let poll: ReturnType<typeof setInterval> | undefined
  const page = await new Promise<Page>((resolve, reject) => {
    if (!context) {
      reject(new Error('CDP endpoint connected but reported no browser context'))
      return
    }
    const timer = setTimeout(() => {
      clearInterval(poll)
      reject(new Error('no renderer page'))
    }, 15_000)
    poll = setInterval(() => {
      const existing = context.pages().find((candidate) => candidate.url() !== 'about:blank')
      if (!existing) return
      clearTimeout(timer)
      clearInterval(poll)
      resolve(existing)
    }, 100)
  })
  await page.waitForLoadState('domcontentloaded')
  return { browser, page }
}

/** Spawn a secondary instance sharing the primary's profile: the single-
 *  instance lock makes it forward argv to the running app and exit. It quits
 *  before Playwright could attach, so no CDP here — the primary asserts the
 *  outcome (same pattern as launchSecondary in file-association.spec.ts). */
async function spawnForwardingInstance(
  target: string,
  userDataDir: string,
  configDir: string
): Promise<void> {
  const child = spawn(ELECTRON_BINARY, ['--headless', 'out/main/index.js', target], {
    cwd: REPO_ROOT,
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      MM_USER_DATA_DIR: userDataDir,
      MM_CONFIG_DIR: configDir,
      MM_SINGLE_INSTANCE: '1'
    }
  })
  spawned.push(child)
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 10_000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function killSpawned(): void {
  for (const child of spawned) {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
  spawned = []
}

test.beforeEach(() => {
  dirs = []
})

test.afterEach(async () => {
  killSpawned()
  for (const dir of dirs) {
    // The spawned processes may hold handles briefly; a small retry keeps
    // Windows tmp cleanup deterministic.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }
})

test('FR-005 cold launch: argv folder opens as the workspace', async () => {
  const workspace = makeDir('mm-store-cold-')
  fs.writeFileSync(path.join(workspace, 'alpha.md'), '# Alpha\n\nCold launch.')
  const configDir = makeDir('mm-store-cold-cfg-')
  const userDataDir = makeDir('mm-store-cold-ud-')

  const { browser, page } = await spawnWithTarget(workspace, userDataDir, configDir)

  await expect(page.getByRole('treeitem').getByText('alpha.md')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('footer-workspace')).toContainText(path.basename(workspace))
  await browser.close().catch(() => {})
})

test('FR-005 running instance: a second argv invocation routes to the first', async () => {
  const workspaceA = makeDir('mm-store-route-a-')
  fs.writeFileSync(path.join(workspaceA, 'a.md'), '# A')
  const workspaceB = makeDir('mm-store-route-b-')
  fs.writeFileSync(path.join(workspaceB, 'b.md'), '# B')
  const configDir = makeDir('mm-store-route-cfg-')
  const userDataDir = makeDir('mm-store-route-ud-')

  let app: ElectronApplication | undefined
  let window: Page | undefined
  try {
    ;({ app, window } = await launchApp(configDir, workspaceA, userDataDir, {
      MM_SINGLE_INSTANCE: '1'
    }))
    await openFolder(window)
    await expect(window.getByTestId('footer-workspace')).toContainText(path.basename(workspaceA))

    await spawnForwardingInstance(workspaceB, userDataDir, configDir)

    // The spawned process must have forwarded its argv and exited; the FIRST
    // process switches workspaces exactly as with the classic verb.
    await expect(window.getByTestId('footer-workspace')).toContainText(path.basename(workspaceB), {
      timeout: 20_000
    })
    await app.close().catch(() => {})
  } catch (error) {
    await closeAppSafely(app)
    throw error
  }
})

test('FR-004 parity: cold launch of a missing folder fails closed and quiet', async () => {
  const workspace = makeDir('mm-store-miss-')
  const configDir = makeDir('mm-store-miss-cfg-')
  const userDataDir = makeDir('mm-store-miss-ud-')

  const { browser, page } = await spawnWithTarget(
    path.join(workspace, 'gone'),
    userDataDir,
    configDir
  )

  // No native dialog is involved in a failed open: main sends the scrubbed
  // message and the renderer shows the quiet footer note (FR-011 parity).
  await expect(page.getByTestId('footer-note')).toContainText('no longer available', {
    timeout: 20_000
  })
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByTestId('footer-document')).toContainText('No document open')
  await browser.close().catch(() => {})
})
