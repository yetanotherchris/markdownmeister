import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import * as atomicWriteModule from '../../src/main/fs/atomicWrite'

/**
 * Spec 069: file:writeOpened accepts only a real path main allowlisted, and
 * file:saveDialog allowlists a chosen file only after the write succeeds.
 */

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), getVersion: () => '0.0.0', isPackaged: false },
  ipcMain: { handle: mocks.handle },
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
    showSaveDialog: mocks.showSaveDialog
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn(async () => '') }
}))

import { registerFileHandlers } from '../../src/main/ipc/handlers/files'
import { canonicalPath, ctx, openFileFromPath } from '../../src/main/ipc/handlers/context'

const APPROVED_URL = 'file:///app/index.html'

function fakeWindow(): BrowserWindow {
  return { webContents: {} } as unknown as BrowserWindow
}

function eventFor(window: BrowserWindow, authorized = true): IpcMainInvokeEvent {
  return {
    sender: authorized ? window.webContents : {},
    senderFrame: { url: APPROVED_URL }
  } as unknown as IpcMainInvokeEvent
}

function handlerFor(channel: string): (event: unknown, payload?: unknown) => unknown {
  const call = [...mocks.handle.mock.calls].reverse().find(([name]) => name === channel)
  if (!call) throw new Error(`channel ${channel} was never registered`)
  return call[1] as (event: unknown, payload?: unknown) => unknown
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mm-write-opened-'))
}

let window: BrowserWindow
let root: string

beforeEach(() => {
  mocks.handle.mockClear()
  mocks.showOpenDialog.mockReset()
  mocks.showSaveDialog.mockReset()
  ctx.approvedRendererUrl = APPROVED_URL
  ctx.workspaceRoot = null
  ctx.workspaceState = null
  ctx.openedPaths.clear()
  window = fakeWindow()
  root = tempDir()
  registerFileHandlers(window, ctx)
})

afterEach(() => {
  ctx.approvedRendererUrl = null
  ctx.workspaceRoot = null
  ctx.workspaceState = null
  ctx.openedPaths.clear()
  fs.rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function allow(file: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, 'original')
  const opened = openFileFromPath(file)
  return opened.canonicalPath!
}

describe('file:writeOpened', () => {
  it('writes an allowlisted file and returns a receipt', () => {
    const file = allow(path.join(root, 'note.md'))
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'updated'
    }) as { ok: boolean; value: { size: number } }

    expect(result.ok).toBe(true)
    expect(result.value.size).toBe(Buffer.byteLength('updated'))
    expect(typeof result.value.mtimeMs).toBe('number')
    expect(fs.readFileSync(file, 'utf-8')).toBe('updated')
  })

  it('rejects an unauthorized renderer', () => {
    const file = allow(path.join(root, 'note.md'))
    const result = handlerFor('file:writeOpened')(eventFor(window, false), {
      canonicalPath: file,
      content: 'nope'
    }) as { ok: boolean; code: string; message: string }

    expect(result).toEqual({ ok: false, code: 'IO', message: 'Unauthorized renderer' })
    expect(fs.readFileSync(file, 'utf-8')).toBe('original')
  })

  it('does not create a missing allowlisted file', () => {
    const file = allow(path.join(root, 'note.md'))
    fs.rmSync(file)
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'recreated'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('NOT_FOUND')
    expect(result.message).not.toContain(root)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('rejects a directory that replaced an opened file', () => {
    const file = allow(path.join(root, 'note.md'))
    fs.rmSync(file)
    fs.mkdirSync(file)
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'nope'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('IO')
    expect(result.message).not.toContain(root)
    expect(fs.statSync(file).isDirectory()).toBe(true)
  })

  it('rejects a path that was never opened', () => {
    const file = path.join(root, 'other.md')
    fs.writeFileSync(file, 'keep')
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'changed'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('OUTSIDE_WORKSPACE')
    expect(result.message).not.toContain(root)
    expect(fs.readFileSync(file, 'utf-8')).toBe('keep')
  })

  it('rejects a .. path whose real path was not opened', () => {
    allow(path.join(root, 'note.md'))
    const sibling = path.join(root, 'secret.md')
    fs.writeFileSync(sibling, 'secret')
    const traversal = path.join(root, 'note.md', '..', 'secret.md')
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: traversal,
      content: 'pwned'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('OUTSIDE_WORKSPACE')
    expect(result.message).not.toContain(root)
    expect(fs.readFileSync(sibling, 'utf-8')).toBe('secret')
  })

  it('writes an allowlisted file addressed by a .. path that resolves to it', () => {
    const file = allow(path.join(root, 'note.md'))
    fs.mkdirSync(path.join(root, 'sub'))
    const viaParent = path.join(root, 'sub', '..', 'note.md')
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: viaParent,
      content: 'resolved'
    }) as { ok: boolean }

    expect(result.ok).toBe(true)
    expect(fs.readFileSync(file, 'utf-8')).toBe('resolved')
  })

  it('rejects a symlink or junction whose real path is not allowlisted', () => {
    const targetDir = path.join(root, 'secret-dir')
    const secret = path.join(targetDir, 'secret.md')
    fs.mkdirSync(targetDir)
    fs.writeFileSync(secret, 'secret')
    const fileLink = path.join(root, 'link.md')
    let linked = fileLink
    try {
      fs.symlinkSync(secret, fileLink, 'file')
    } catch {
      // A file symlink needs extra privileges on Windows. A directory junction
      // resolves through the same real path and needs none.
      linked = path.join(root, 'linkdir')
      fs.symlinkSync(targetDir, linked, 'junction')
    }
    allow(path.join(root, 'note.md'))

    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: linked,
      content: 'pwned'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('OUTSIDE_WORKSPACE')
    expect(result.message).not.toContain(root)
    expect(fs.readFileSync(secret, 'utf-8')).toBe('secret')
  })

  it('rejects a symlink after it is retargeted away from the opened file', () => {
    const opened = path.join(root, 'note.md')
    const secret = path.join(root, 'secret.md')
    const link = path.join(root, 'link.md')
    fs.writeFileSync(secret, 'secret')
    try {
      fs.symlinkSync(opened, link, 'file')
    } catch {
      return
    }
    allow(opened)
    fs.rmSync(link)
    fs.symlinkSync(secret, link, 'file')

    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: link,
      content: 'pwned'
    }) as { ok: boolean; code: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('OUTSIDE_WORKSPACE')
    expect(fs.readFileSync(opened, 'utf-8')).toBe('original')
    expect(fs.readFileSync(secret, 'utf-8')).toBe('secret')
  })

  it('scrubs an absolute path out of a rejection', () => {
    const file = path.join(root, 'other.md')
    fs.writeFileSync(file, 'keep')
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'changed'
    }) as { ok: boolean; message: string }

    expect(result.message).toBe('Path is not an opened file')
    expect(result.message).not.toContain(file)
    expect(result.message).not.toContain(root)
  })

  it.each(['EACCES', 'EBUSY', 'EPERM'] as const)(
    'maps %s to LOCKED and leaves the original bytes',
    (code) => {
      const file = allow(path.join(root, 'note.md'))
      vi.spyOn(atomicWriteModule, 'atomicWrite').mockImplementation(() => {
        const error = new Error(`failed at ${file}`) as NodeJS.ErrnoException
        error.code = code
        throw error
      })
      const result = handlerFor('file:writeOpened')(eventFor(window), {
        canonicalPath: file,
        content: 'truncated'
      }) as { ok: boolean; code: string; message: string }

      expect(result.ok).toBe(false)
      expect(result.code).toBe('LOCKED')
      expect(result.message).toBe('File is locked by another program')
      expect(result.message).not.toContain(root)
      expect(fs.readFileSync(file, 'utf-8')).toBe('original')
    }
  )

  it('maps ENOSPC to IO', () => {
    const file = allow(path.join(root, 'note.md'))
    vi.spyOn(atomicWriteModule, 'atomicWrite').mockImplementation(() => {
      const error = new Error('no space') as NodeJS.ErrnoException
      error.code = 'ENOSPC'
      throw error
    })
    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'truncated'
    }) as { ok: boolean; code: string; message: string }

    expect(result.ok).toBe(false)
    expect(result.code).toBe('IO')
    expect(result.message).toBe('Disk full')
    expect(fs.readFileSync(file, 'utf-8')).toBe('original')
  })

  it('keeps the allowlist when the open folder changes', () => {
    const file = allow(path.join(root, 'note.md'))
    const elsewhere = path.join(root, 'elsewhere')
    fs.mkdirSync(elsewhere)
    ctx.workspaceRoot = elsewhere

    const result = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'still-open'
    }) as { ok: boolean }

    expect(result.ok).toBe(true)
    expect(fs.readFileSync(file, 'utf-8')).toBe('still-open')
  })
})

describe('file:saveDialog allowlist', () => {
  it('allowlists nothing when the dialog is cancelled', async () => {
    const file = path.join(root, 'chosen.md')
    fs.writeFileSync(file, 'keep')
    mocks.showSaveDialog.mockResolvedValue({ canceled: true, filePath: file })

    const result = await handlerFor('file:saveDialog')(eventFor(window), {
      suggestedName: 'chosen.md',
      content: 'new'
    })
    expect(result).toEqual({ ok: true, value: null })

    const rejected = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: file,
      content: 'new'
    }) as { ok: boolean; code: string }
    expect(rejected.ok).toBe(false)
    expect(rejected.code).toBe('OUTSIDE_WORKSPACE')
    expect(fs.readFileSync(file, 'utf-8')).toBe('keep')
  })

  it('allowlists a file chosen outside the open folder after the write succeeds', async () => {
    const folder = path.join(root, 'folder')
    const outside = path.join(root, 'outside.md')
    fs.mkdirSync(folder)
    fs.writeFileSync(path.join(folder, 'inside.md'), 'inside')
    ctx.workspaceRoot = folder
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outside })

    const result = (await handlerFor('file:saveDialog')(eventFor(window), {
      suggestedName: 'outside.md',
      content: 'chosen'
    })) as {
      ok: boolean
      value: { path: string | null; canonicalPath?: string; name: string }
    }

    const real = canonicalPath(outside)
    expect(result.ok).toBe(true)
    expect(result.value.path).toBeNull()
    expect(result.value.canonicalPath).toBe(real)
    expect(result.value.name).toBe('outside.md')
    expect(fs.readFileSync(outside, 'utf-8')).toBe('chosen')

    const written = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: real,
      content: 'again'
    }) as { ok: boolean }
    expect(written.ok).toBe(true)
    expect(fs.readFileSync(outside, 'utf-8')).toBe('again')
    expect(fs.readFileSync(path.join(folder, 'inside.md'), 'utf-8')).toBe('inside')
  })

  it('returns a workspace-relative path when the chosen file is inside the folder', async () => {
    const folder = path.join(root, 'folder')
    fs.mkdirSync(folder)
    ctx.workspaceRoot = folder
    const inside = path.join(folder, 'chosen.md')
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: inside })

    const result = (await handlerFor('file:saveDialog')(eventFor(window), {
      suggestedName: 'chosen.md',
      content: 'inside'
    })) as { ok: boolean; value: { path: string | null; canonicalPath?: string } }

    expect(result.ok).toBe(true)
    expect(result.value.path).toBe('chosen.md')
    expect(result.value.canonicalPath).toBe(canonicalPath(inside))
    expect(ctx.workspaceRoot).toBe(folder)
  })

  it('allowlists nothing when the chosen write fails', async () => {
    const outside = path.join(root, 'outside.md')
    fs.writeFileSync(outside, 'keep')
    vi.spyOn(atomicWriteModule, 'atomicWrite').mockImplementation(() => {
      const error = new Error('locked') as NodeJS.ErrnoException
      error.code = 'EACCES'
      throw error
    })
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outside })

    const result = (await handlerFor('file:saveDialog')(eventFor(window), {
      suggestedName: 'outside.md',
      content: 'new'
    })) as { ok: boolean }

    expect(result.ok).toBe(false)
    expect(fs.readFileSync(outside, 'utf-8')).toBe('keep')
    const rejected = handlerFor('file:writeOpened')(eventFor(window), {
      canonicalPath: outside,
      content: 'new'
    }) as { ok: boolean; code: string }
    expect(rejected.ok).toBe(false)
    expect(rejected.code).toBe('OUTSIDE_WORKSPACE')
  })
})
