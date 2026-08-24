import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'


export function atomicWrite(filePath: string, content: string, mode?: number): void {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const randomSuffix = crypto.randomBytes(6).toString('hex')
  const tempPath = path.join(dir, `.${base}.tmp-${randomSuffix}`)

  const options: fs.WriteFileOptions =
    mode === undefined ? { encoding: 'utf-8', flag: 'wx' } : { encoding: 'utf-8', flag: 'wx', mode }

  let fd: number | null = null
  try {
    fs.writeFileSync(tempPath, content, options)
    fd = fs.openSync(tempPath, 'r+')
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = null
    fs.renameSync(tempPath, filePath)
  } catch (e: unknown) {
    if (fd !== null) {
      try {
        fs.closeSync(fd)
      } catch {
        /* preserve the original write failure */
      }
    }
    try {
      fs.unlinkSync(tempPath)
    } catch {
      /* best-effort cleanup */
    }
    throw e
  }
}
