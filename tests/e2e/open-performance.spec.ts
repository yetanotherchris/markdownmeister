import { test, expect, ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { launchApp, closeAppSafely } from './launch'

/**
 * Spec 033 suite (contracts/open-performance.md): same-tab opens present the
 * incoming document within the SC-001 timing target for typical documents
 * (p95 ≤ 250 ms locally, a documented ×4 CI tolerance), scale linearly with
 * document size (SC-004, the fixed budget does not extend to very large
 * documents, whose floor is the single mandatory construction parse, research
 * R7), perform exactly one full parse and at most one incoming serialization
 * per open with zero outgoing serializations for an untouched tab
 * (SC-002/SC-003, read from the window.__mmOpenPerformance counters), and
 * preserve every staged-replacement guarantee (SC-005).
 */

let app: ElectronApplication
let window: Page
let testFolder: string
let configDir: string

const SMALL_LINES = 1_000
const LARGE_LINES = 10_000

function generateDocument(title: string, lines: number): string {
  const parts: string[] = [`# ${title}`, '']
  for (let i = 1; i <= lines; i++) {
    if (i % 25 === 0) parts.push(`## Section ${i}`, '')
    else if (i % 7 === 0) parts.push(`- item ${i} with a little more text to fill the line`, '')
    else parts.push(`Paragraph ${i}: the quick brown fox jumps over the lazy dog.`, '')
  }
  return parts.join('\n')
}

test.beforeAll(async () => {
  testFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-open-perf-ws-'))
  fs.writeFileSync(path.join(testFolder, 'small.md'), generateDocument('Small', SMALL_LINES))
  fs.writeFileSync(path.join(testFolder, 'small2.md'), generateDocument('Small Two', SMALL_LINES))
  fs.writeFileSync(path.join(testFolder, 'large.md'), generateDocument('Large', LARGE_LINES))
})

test.beforeEach(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-open-perf-config-'))
  ;({ app, window } = await launchApp(configDir, testFolder))
})

test.afterEach(async () => {
  await closeAppSafely(app)
  fs.rmSync(configDir, { recursive: true, force: true })
})

test.afterAll(async () => {
  fs.rmSync(testFolder, { recursive: true, force: true })
})

interface PerfCounters {
  fullParses: number
  fullSerializations: number
  outgoingSerializations: number
  openDurations: number[]
}

async function resetCounters(): Promise<void> {
  await window.evaluate(() => {
    ;(window as unknown as { __mmOpenPerformance?: { reset: () => void } }).__mmOpenPerformance?.reset()
  })
}

async function readCounters(): Promise<PerfCounters> {
  return window.evaluate(() => {
    const perf = (
      window as unknown as {
        __mmOpenPerformance?: { getCounters: () => PerfCounters }
      }
    ).__mmOpenPerformance
    if (!perf) throw new Error('window.__mmOpenPerformance is not exposed')
    return perf.getCounters()
  })
}

async function openWorkspace(): Promise<void> {
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Open Folder…' }).click()
  await expect(window.getByRole('treeitem').getByText('small.md')).toBeVisible()
}

/** Single-click a file and wait until it is presented (atomic swap done). */
async function openFile(name: string): Promise<void> {
  await window.getByRole('treeitem').getByText(name).click()
  await expect(window.locator('.document-title')).toContainText(name)
  await expect(window.locator('.ProseMirror:visible')).toBeVisible()
}

function percentile(durations: number[], p: number): number {
  const sorted = [...durations].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
  return sorted[idx]
}

// The SC-001 target (250 ms p95) applies to reference hardware; shared CI
// runners get the documented tolerance multiplier (research R6). Local runs
// are the primary signal.
const TIMING_MULTIPLIER = process.env.CI ? 4 : 1
const SC001_TARGET_MS = 250 * TIMING_MULTIPLIER

test('SC-001 a same-tab open of a typical document presents it within the target (p95)', async () => {
  await openWorkspace()
  await openFile('small.md')
  // One unmeasured warm-up mount so JIT/module-init costs do not dominate p95.
  await openFile('small2.md')

  const runs = 12
  await resetCounters()
  for (let i = 0; i < runs; i++) {
    // Alternate the two small fixtures so every click replaces the clean
    // active tab with a fresh ~1,000-line mount (never an already-open tab).
    // The warm-up left small2.md active, so the loop starts with small.md.
    await openFile(i % 2 === 0 ? 'small.md' : 'small2.md')
  }
  const counters = await readCounters()
  expect(counters.openDurations.length).toBe(runs)

  const relevant = counters.openDurations
  const p95 = percentile(relevant, 0.95)
  // Report, then assert, the printed figure is the primary local signal.
  console.log(
    `typical-doc open durations ms: [${relevant.map((d) => d.toFixed(0)).join(', ')}] ` +
      `min=${Math.min(...relevant).toFixed(1)} ` +
      `median=${percentile(relevant, 0.5).toFixed(1)} p95=${p95.toFixed(1)} ` +
      `(target ${SC001_TARGET_MS}ms, multiplier ×${TIMING_MULTIPLIER})`
  )
  expect(p95).toBeLessThanOrEqual(SC001_TARGET_MS)
})

test('SC-004 opening a ten-times-larger document scales linearly', async () => {
  await openWorkspace()
  await openFile('small.md')

  const runsPerSize = 6
  await resetCounters()
  for (let i = 0; i < runsPerSize * 2; i++) {
    await openFile(i % 2 === 0 ? 'large.md' : 'small.md')
  }
  const { openDurations } = await readCounters()
  const large = openDurations.filter((_, i) => i % 2 === 0)
  const small = openDurations.filter((_, i) => i % 2 === 1)
  expect(large.length).toBe(runsPerSize)
  expect(small.length).toBe(runsPerSize)

  const median = (xs: number[]) => percentile(xs, 0.5)
  const ratio = median(large) / median(small)
  console.log(
    `scaling median(large)=${median(large).toFixed(1)}ms ` +
      `median(small)=${median(small).toFixed(1)}ms ratio=${ratio.toFixed(2)} (≤12)`
  )
  // SC-004: no more than roughly ten times, bounded at twelve (20% overhead).
  // This scaling law, not SC-001's fixed budget, governs very large
  // documents, whose floor is the single mandatory construction parse (R7).
  expect(ratio).toBeLessThanOrEqual(12)
})

test('SC-002/SC-003 one open with unchanged settings parses once, serializes incoming once, outgoing zero times', async () => {
  await openWorkspace()
  await openFile('small.md')

  await resetCounters()
  await openFile('large.md')
  const counters = await readCounters()

  // SC-002: exactly one full interpretation pass over the incoming content,
  // the constructor's parse; the reconfigure skip guard suppressed parse #2.
  expect(counters.fullParses).toBe(1)
  // SC-003: at most one whole-content serialization of the incoming content
  // (the baseline capture); none beyond it.
  expect(counters.fullSerializations).toBeLessThanOrEqual(1)
  // The untouched outgoing tab is proven clean by document identity, zero
  // outgoing serializations (was three before this feature).
  expect(counters.outgoingSerializations).toBe(0)
})

test('SC-002 flip side: an open with CHANGED display settings legitimately re-parses', async () => {
  await openWorkspace()
  await openFile('small.md')

  // Toggle a syntax off through the settings dialog so the next open must
  // build the non-default pipeline (constructor parse + replaceAll re-parse).
  await window.getByRole('button', { name: 'Open menu' }).click()
  await window.getByRole('menuitem', { name: 'Settings…' }).click()
  const dialog = window.getByTestId('settings-dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Markdown' }).click()
  await dialog
    .locator('.settings-switch-text', { hasText: 'Strikethrough formatting' })
    .waitFor()
  await dialog.locator('.settings-switch', { hasText: 'Strikethrough formatting' }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0)

  await resetCounters()
  await openFile('large.md')
  const counters = await readCounters()
  // Constructor parse + the swap path's replaceAll re-parse: two passes are
  // CORRECT when the settings changed (contract C4 scopes single-parse to
  // unchanged settings).
  expect(counters.fullParses).toBe(2)
})

test('SC-005 staged replacement stays atomic, typing lands immediately, dirty tabs stay protected', async () => {
  await openWorkspace()
  await openFile('small.md')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Small')

  // With immediate commits the staging window can close faster than one
  // Playwright poll, so the atomicity invariant is sampled inside the page:
  // every frame pairs the header title with the VISIBLE editor's text, and no
  // sample may mix the outgoing and incoming documents (or go blank).
  await window.evaluate(() => {
    const w = window as unknown as { __samples?: string[]; __sampling?: boolean }
    w.__samples = []
    w.__sampling = true
    const read = () => {
      const title = document.querySelector('.document-title')?.textContent ?? ''
      const hosts = Array.from(document.querySelectorAll<HTMLElement>('.editor-host'))
      const visible = hosts.find((h) => h.style.visibility !== 'hidden')
      const content = (visible?.querySelector('.ProseMirror')?.textContent ?? '').slice(0, 60)
      w.__samples!.push(`${title} :: ${content}`)
      if (w.__sampling) requestAnimationFrame(read)
    }
    requestAnimationFrame(read)
  })

  await window.getByRole('treeitem').getByText('large.md').click()
  await expect(window.locator('.document-title')).toContainText('large.md')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Large')

  const samples = await window.evaluate(() => {
    ;(window as unknown as { __sampling?: boolean }).__sampling = false
    return (window as unknown as { __samples?: string[] }).__samples ?? []
  })
  const inconsistent = samples.filter((sample) => {
    if (sample.includes('small.md')) return !sample.includes('Small')
    if (sample.includes('large.md')) return !sample.includes('Large')
    return false
  })
  expect(inconsistent, `inconsistent samples:\n${inconsistent.join('\n')}`).toEqual([])

  // Keystrokes land in the new document immediately; undo history is fresh,
  // undoing the typed text must not resurrect the previous document.
  await window.locator('[contenteditable="true"]').first().click()
  await window.keyboard.type('XYZZY ')
  await expect(window.locator('.ProseMirror:visible')).toContainText('XYZZY')
  await window.keyboard.press('Control+z')
  await expect(window.locator('.ProseMirror:visible')).not.toContainText('XYZZY')
  await expect(window.locator('.ProseMirror:visible')).toContainText('Large')

  // A dirty active tab is never replaced: the new file opens a new tab.
  await window.keyboard.type('dirty edit')
  await expect(window.locator('.document-title')).toContainText('\u2022')
  await openFile('small.md')
  await expect(window.getByRole('tab')).toHaveCount(2)
  await expect(window.getByRole('tab', { name: /large\.md/ })).toBeVisible()
})
