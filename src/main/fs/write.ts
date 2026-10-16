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

/** Write an absolute path that the caller has already authorized. Does not create a missing file. */
export function writeOpenedFile(absolutePath: string, content: string): WriteReceipt {
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch (e: unknown) {
    const errno = e instanceof Error ? (e as NodeJS.ErrnoException).code : undefined
    if (errno === 'ENOENT') {
      throw Object.assign(new Error('File or directory not found'), { code: 'NOT_FOUND' })
    }
    throw e
  }
  if (!stat.isFile()) {
    throw Object.assign(new Error('Target is not a file'), { code: 'IO' })
  }

  try {
    atomicWrite(absolutePath, content)
    const written = fs.statSync(absolutePath)
    return { mtimeMs: written.mtimeMs, size: written.size }
  } catch (e: unknown) {
    mapWriteError(e)
  }
}
