import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { canonicalPath } from '../../src/main/fs/identity'

describe('canonicalPath', () => {
  let root: string
  let file: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-identity-'))
    fs.mkdirSync(path.join(root, 'sub'))
    file = path.join(root, 'a.md')
    fs.writeFileSync(file, '# A')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns the native real path for an existing file', () => {
    expect(canonicalPath(file)).toBe(path.normalize(fs.realpathSync.native(file)))
  })

  it('resolves a sub/../ spelling to the same identity', () => {
    const spelled = `${root}${path.sep}sub${path.sep}..${path.sep}a.md`
    expect(canonicalPath(spelled)).toBe(canonicalPath(file))
  })

  it('falls back to fs.realpathSync when the native call throws', () => {
    const native = vi.spyOn(fs.realpathSync, 'native').mockImplementation(() => {
      throw Object.assign(new Error('native realpath unavailable'), { code: 'ENOSYS' })
    })

    expect(canonicalPath(file)).toBe(path.normalize(fs.realpathSync(file)))
    expect(native).toHaveBeenCalled()
  })

  it('falls back to an absolute resolved path when the path does not exist', () => {
    const missing = path.join(root, 'missing.md')
    const result = canonicalPath(missing)

    expect(result).toBe(path.normalize(path.resolve(missing)))
    expect(path.isAbsolute(result)).toBe(true)
  })

  it('normalizes a realpath result with redundant segments', () => {
    const raw = `${root}${path.sep}sub${path.sep}..${path.sep}.${path.sep}a.md`
    vi.spyOn(fs.realpathSync, 'native').mockReturnValue(raw)

    expect(canonicalPath(file)).toBe(path.normalize(raw))
    expect(canonicalPath(file)).not.toBe(raw)
  })
})
