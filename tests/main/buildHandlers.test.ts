import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { REPOSITORY_URL } from '../../src/main/buildInfo'

/**
 * Spec 037 handler behaviour at the IPC boundary (constitution V: IPC contract
 * shape). The electron module is mocked so the REAL registration and
 * authorization code runs while `ipcMain.handle` is captured and
 * `shell.openExternal` recorded. This is the first vi.mock use in tests/main
 * (research R8): the authorization guard lives inline in the handlers, exactly
 * like every other channel, so exercising it requires the module boundary.
 */

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  openExternal: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '9.9.9', isPackaged: false },
  ipcMain: { handle: mocks.handle },
  shell: { openExternal: mocks.openExternal }
}))

import { registerBuildHandlers } from '../../src/main/ipc/handlers/build'
import { ctx } from '../../src/main/ipc/handlers/context'

const APPROVED_URL = 'file:///app/index.html'

function fakeWindow(): BrowserWindow {
  return { webContents: {} } as unknown as BrowserWindow
}

function eventFor(window: BrowserWindow, authorized: boolean): IpcMainInvokeEvent {
  return {
    sender: authorized ? window.webContents : {},
    senderFrame: { url: APPROVED_URL }
  } as unknown as IpcMainInvokeEvent
}

function handlerFor(channel: string): (event: unknown, payload?: unknown) => unknown {
  const call = mocks.handle.mock.calls.find(([name]) => name === channel)
  if (!call) throw new Error(`channel ${channel} was never registered`)
  return call[1] as (event: unknown, payload?: unknown) => unknown
}

let window: BrowserWindow

beforeEach(() => {
  mocks.handle.mockClear()
  mocks.openExternal.mockReset()
  delete process.env.MM_BUILD_COMMIT
  ctx.approvedRendererUrl = APPROVED_URL
  ctx.allowClose = false
  ctx.quitRequestPending = false
  window = fakeWindow()
  registerBuildHandlers(window, ctx)
})

afterEach(() => {
  // ipcAuthorization.test.ts shares this mutable context; leave it clean.
  ctx.approvedRendererUrl = null
})

describe('registerBuildHandlers (spec 037 contracts/preload.md)', () => {
  it('registers exactly the two named build channels', () => {
    expect(mocks.handle).toHaveBeenCalledTimes(2)
    expect(mocks.handle.mock.calls.map(([name]) => name)).toEqual([
      'build:getInfo',
      'build:openRepository'
    ])
  })

  it('build:getInfo rejects an unauthorized renderer without composing metadata', () => {
    const result = handlerFor('build:getInfo')(eventFor(window, false)) as {
      ok: boolean
      code: string
      message: string
    }
    expect(result.ok).toBe(false)
    expect(result.code).toBe('IO')
    expect(result.message).toBe('Unauthorized renderer')
  })

  it('build:getInfo composes the version, a null revision here, and the exact URL', () => {
    const result = handlerFor('build:getInfo')(eventFor(window, true)) as {
      ok: boolean
      value: { version: string; revision: string | null; repositoryUrl: string }
    }
    expect(result.ok).toBe(true)
    expect(result.value.version).toBe('9.9.9')
    expect(result.value.revision).toBeNull()
    expect(result.value.repositoryUrl).toBe(REPOSITORY_URL)
    expect(REPOSITORY_URL).toBe('https://github.com/yetanotherchris/markdownmeister')
  })

  it('build:openRepository hands the exact URL to the OS exactly once', async () => {
    const result = (await handlerFor('build:openRepository')(eventFor(window, true))) as {
      ok: boolean
      value: null
    }
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
    expect(mocks.openExternal).toHaveBeenCalledWith(
      'https://github.com/yetanotherchris/markdownmeister'
    )
    expect(result).toEqual({ ok: true, value: null })
  })

  it('build:openRepository rejects an unauthorized renderer and never opens anything', async () => {
    const result = (await handlerFor('build:openRepository')(eventFor(window, false))) as {
      ok: boolean
      code: string
      message: string
    }
    expect(result.ok).toBe(false)
    expect(result.code).toBe('IO')
    expect(result.message).toBe('Unauthorized renderer')
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('both handlers tolerate an unexpected payload instead of rejecting it (zero-argument contract)', async () => {
    const info = handlerFor('build:getInfo')(eventFor(window, true), { sneaky: true }) as {
      ok: boolean
    }
    const opened = (await handlerFor('build:openRepository')(
      eventFor(window, true),
      { sneaky: true }
    )) as { ok: boolean }
    expect(info.ok).toBe(true)
    expect(opened.ok).toBe(true)
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
    expect(mocks.openExternal).toHaveBeenCalledWith(REPOSITORY_URL)
  })
})
