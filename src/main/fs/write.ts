import * as fs from 'fs'
import { resolveWithinRoot } from './paths'
import { atomicWrite } from './atomicWrite'
import type { WriteReceipt } from '../../shared/ipc-contract'

function mapWriteError(e: unknown): never {
  if (e instanceof Error) {
    const errno = e as NodeJS.ErrnoException
    if (errno.code === 'EBUSY' || errno.code === 'EPERM' || errno.code === 'EACCES') {
      throw Object.assign(new Error('File is locked by another program'), {
        code: 'LOCKED'
      })
    }
    if (errno.code === 'ENOSPC') {
      throw Object.assign(new Error('Disk full'), { code: 'IO' })
    }
  }
  throw Object.assign(new Error('Failed to write file'), { code: 'IO' })
}

export function writeFile(root: string, relativePath: string, content: string): WriteReceipt {
  const { resolved } = resolveWithinRoot(root, relativePath)

  try {
    atomicWrite(resolved, content)

    const stat = fs.statSync(resolved)
    return { mtimeMs: stat.mtimeMs, size: stat.size }
  } catch (e: unknown) {
    mapWriteError(e)
  }
}

/**
 * The mutating calls on an opened handle. Tests replace `writeSync` so they can
 * swap the directory entry after the handle has been checked.
 */
export const openedHandleOps = {
  writeSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number {
    return fs.writeSync(fd, buffer, offset, length, position)
  }
}

function sameFile(opened: fs.Stats, named: fs.Stats): boolean {
  // On Windows fs.stat leaves dev at 0 while fs.fstat reports the volume id.
  // The file index distinguishes a swapped directory entry, and the real path
  // already has to match, so a zero dev is not a different volume.
  if (opened.ino !== named.ino) return false
  return opened.dev === 0 || named.dev === 0 || opened.dev === named.dev
}

function readHandle(fd: number, size: number): Buffer {
  const data = Buffer.alloc(size)
  let offset = 0
  while (offset < size) {
    const read = fs.readSync(fd, data, offset, size - offset, offset)
    if (read === 0) break
    offset += read
  }
  return data.subarray(0, offset)
}

function writeHandle(fd: number, bytes: Buffer): void {
  let offset = 0
  while (offset < bytes.length) {
    const wrote = openedHandleOps.writeSync(fd, bytes, offset, bytes.length - offset, offset)
    if (wrote <= 0) {
      throw Object.assign(new Error('Failed to write file'), { code: 'IO' })
    }
    offset += wrote
  }
}

/**
 * Replace the bytes of an already-open file. A later change to the path cannot
 * retarget this write. On a thrown write, put the previous bytes back.
 */
function replaceOpenedHandle(fd: number, content: string): void {
  const previous = readHandle(fd, fs.fstatSync(fd).size)
  const next = Buffer.from(content, 'utf8')
  try {
    writeHandle(fd, next)
    fs.ftruncateSync(fd, next.length)
    fs.fsyncSync(fd)
  } catch (e: unknown) {
    try {
      writeHandle(fd, previous)
      fs.ftruncateSync(fd, previous.length)
      fs.fsyncSync(fd)
    } catch {
      // Preserve the error from the attempt to write the new content.
    }
    throw e
  }
}

function openOpenedError(e: unknown): never {
  const errno = e instanceof Error ? (e as NodeJS.ErrnoException).code : undefined
  if (errno === 'ENOENT') {
    throw Object.assign(new Error('File or directory not found'), { code: 'NOT_FOUND' })
  }
  if (errno === 'EISDIR') {
    throw Object.assign(new Error('Target is not a file'), { code: 'IO' })
  }
  mapWriteError(e)
}

/**
 * Write an absolute path that the caller has already authorized.
 * Does not create a missing file. The bytes go through the handle opened for
 * the allowlisted path, so a directory entry swapped in before the write is
 * not the file that changes.
 */
export function writeOpenedFile(absolutePath: string, content: string): WriteReceipt {
  let fd: number
  try {
    fd = fs.openSync(absolutePath, 'r+')
  } catch (e: unknown) {
    openOpenedError(e)
  }

  try {
    const opened = fs.fstatSync(fd)
    if (!opened.isFile()) {
      throw Object.assign(new Error('Target is not a file'), { code: 'IO' })
    }
    let real: string
    try {
      real = fs.realpathSync(absolutePath)
    } catch (e: unknown) {
      const errno = e instanceof Error ? (e as NodeJS.ErrnoException).code : undefined
      if (errno === 'ENOENT') {
        throw Object.assign(new Error('File or directory not found'), { code: 'NOT_FOUND' })
      }
      mapWriteError(e)
    }
    if (real !== absolutePath) {
      throw Object.assign(new Error('Path is not an opened file'), { code: 'OUTSIDE_WORKSPACE' })
    }
    const named = fs.lstatSync(absolutePath)
    if (named.isSymbolicLink() || !sameFile(named, opened)) {
      throw Object.assign(new Error('Path is not an opened file'), { code: 'OUTSIDE_WORKSPACE' })
    }

    try {
      replaceOpenedHandle(fd, content)
    } catch (e: unknown) {
      mapWriteError(e)
    }
    const written = fs.fstatSync(fd)
    return { mtimeMs: written.mtimeMs, size: written.size }
  } finally {
    fs.closeSync(fd)
  }
}
