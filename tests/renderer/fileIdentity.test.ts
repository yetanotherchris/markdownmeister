import { describe, expect, it } from 'vitest'
import { sameFile } from '../../src/renderer/domain/fileIdentity'

describe('sameFile', () => {
  it('matches equal identities even when the paths differ', () => {
    expect(
      sameFile(
        { path: null, canonicalPath: '/notes/a.md' },
        { path: 'a.md', canonicalPath: '/notes/a.md' }
      )
    ).toBe(true)
  })

  it('does not match different identities even when the paths are equal', () => {
    expect(
      sameFile(
        { path: 'a.md', canonicalPath: '/notes/dir/a.md' },
        { path: 'a.md', canonicalPath: '/notes/dir2/a.md' }
      )
    ).toBe(false)
  })

  it('falls back to equal paths when one identity is missing', () => {
    expect(sameFile({ path: 'a.md' }, { path: 'a.md', canonicalPath: '/notes/a.md' })).toBe(true)
  })

  it('matches a case-variant path when both identities are equal', () => {
    expect(
      sameFile(
        { path: 'a.md', canonicalPath: '/notes/a.md' },
        { path: 'A.md', canonicalPath: '/notes/a.md' }
      )
    ).toBe(true)
  })

  it('does not match a null path against a different identity', () => {
    expect(
      sameFile(
        { path: null, canonicalPath: '/notes/a.md' },
        { path: 'a.md', canonicalPath: '/notes/b.md' }
      )
    ).toBe(false)
  })

  it('does not match different paths when only one side has an identity', () => {
    expect(sameFile({ path: 'a.md', canonicalPath: '/notes/a.md' }, { path: 'b.md' })).toBe(false)
  })

  it('does not match a null path against a relative path when one identity is missing', () => {
    expect(sameFile({ path: null }, { path: 'a.md', canonicalPath: '/notes/a.md' })).toBe(false)
    expect(sameFile({ path: null, canonicalPath: '/notes/a.md' }, { path: 'a.md' })).toBe(false)
  })

  it('does not match two null paths when both identities are missing', () => {
    expect(sameFile({ path: null }, { path: null })).toBe(false)
  })

  it('falls back to equal paths when both identities are missing', () => {
    expect(sameFile({ path: 'a.md' }, { path: 'a.md' })).toBe(true)
    expect(sameFile({ path: 'a.md' }, { path: 'b.md' })).toBe(false)
  })

  it('treats an empty identity as missing', () => {
    expect(
      sameFile({ path: 'a.md', canonicalPath: '' }, { path: 'a.md', canonicalPath: '/notes/a.md' })
    ).toBe(true)
    expect(sameFile({ path: 'a.md', canonicalPath: '' }, { path: 'a.md', canonicalPath: '' })).toBe(
      true
    )
    expect(sameFile({ path: null, canonicalPath: '' }, { path: 'a.md' })).toBe(false)
    expect(sameFile({ path: 'a.md', canonicalPath: '' }, { path: 'b.md', canonicalPath: '' })).toBe(
      false
    )
  })
})
