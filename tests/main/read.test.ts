import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { readFile } from '../../src/main/fs/read'
import { canonicalPath } from '../../src/main/fs/identity'

describe('readFile identity', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-read-identity-'))
    fs.mkdirSync(path.join(root, 'notes'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns the canonical path of the resolved file', () => {
    const file = path.join(root, 'notes', 'a.md')
    fs.writeFileSync(file, '# A\n')
    const stat = fs.statSync(file)

    const opened = readFile(root, 'notes/a.md')

    expect(opened.canonicalPath).toBe(canonicalPath(file))
    expect(opened.path).toBe('notes/a.md')
    expect(opened.name).toBe('a.md')
    expect(opened.content).toBe('# A\n')
    expect(opened.mtimeMs).toBe(stat.mtimeMs)
    expect(opened.size).toBe(stat.size)
  })

  it('rejects an escaping path with no identity in the error', () => {
    let caught: unknown
    try {
      readFile(root, '../outside.md')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    const error = caught as Error & { code?: string; canonicalPath?: unknown }
    expect(error.code).toBe('OUTSIDE_WORKSPACE')
    expect(error.canonicalPath).toBeUndefined()
  })
})
