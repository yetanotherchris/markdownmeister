import { test, expect } from '@playwright/test'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely, openFolder, stubMessageBox } from './launch'

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
  browser: Awaited<ReturnType<typeof electron.connectOverCDP>>
  page: Page
}

/** Spawn the real binary the way the OS would (argv carries the target) and
 *  attach over CDP via the DevToolsActivePort file in the isolated profile. */
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
    stdio: 'ignore',
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

  const portFile = path.join(userDataDir, 'DevToolsActivePort')
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf-8').split('\n')
      if (port) {
        const browser = await electron.connectOverCDP(`http://127.0.0.1:${port}`)
        const page = await new Promise<Page>((resolve, reject) => {
          const context = browser.contexts()[0]
          const existing = context.pages()[0]
          if (existing && existing.url() !== 'about:blank') return resolve(existing)
          const timer = setTimeout(() => reject(new Error('no renderer page')), 15_000)
          context.on('page', (p) => {
            clearTimeout(timer)
            resolve(p)
          })
        })
        await page.waitForLoadState('domcontentloaded')
        return { browser, page }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`app did not expose a CDP endpoint (${portFile} missing)`)
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

    await spawnWithTarget(workspaceB, userDataDir, configDir)

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
  fs.writeFileSync(path.join(workspace, 'keep.md'), '# Keep')
  const configDir = makeDir('mm-store-miss-cfg-')
  const userDataDir = makeDir('mm-store-miss-ud-')

  const { browser, page } = await spawnWithTarget(
    path.join(workspace, 'gone'),
    userDataDir,
    configDir
  )
  await stubMessageBox(browser)

  await expect(page.getByTestId('footer-note')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByTestId('footer-document')).toContainText('No document open')
  await browser.close().catch(() => {})
})
