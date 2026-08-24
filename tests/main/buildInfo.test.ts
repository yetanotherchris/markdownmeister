import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  REPOSITORY_URL,
  currentBuildInfo,
  effectiveRevision,
  normalizeRevision,
  resolveBuildRevision
} from '../../src/main/buildInfo'

/**
 * Spec 037: build-identity policies. The environment override and
 * git fallback run at electron-vite config load; the policies are extracted so
 * each branch is provable without spawning processes or building. Under vitest
 * no `__BUILD_COMMIT__` define exists, so `embeddedRevision()` is always null
 * here, the embedded-value branches are exercised through explicit arguments.
 */

describe('resolveBuildRevision (build-time policy)', () => {
  it('prefers an explicit MM_BUILD_COMMIT even when the git fallback would fail', () => {
    const runGit = (): string | null => {
      throw new Error('git is not installed')
    }
    expect(resolveBuildRevision('abc123', runGit)).toBe('abc123')
  })

  it('maps an empty MM_BUILD_COMMIT to null without consulting git (placeholder path)', () => {
    let gitCalled = false
    const runGit = (): string | null => {
      gitCalled = true
      return 'def456'
    }
    expect(resolveBuildRevision('', runGit)).toBeNull()
    expect(gitCalled).toBe(false)
  })

  it('falls back to the guarded git revision when the env var is unset', () => {
    expect(resolveBuildRevision(undefined, () => 'def4567890')).toBe('def4567890')
  })

  it('yields null when there is no env var and git fails (honest unknown)', () => {
    expect(resolveBuildRevision(undefined, () => null)).toBeNull()
  })
})

describe('normalizeRevision (honest display value, FR-007)', () => {
  it('passes a real revision through verbatim', () => {
    expect(normalizeRevision('869190df07e1ce2a33df0adc606ec376c5f65bab')).toBe(
      '869190df07e1ce2a33df0adc606ec376c5f65bab'
    )
  })

  it('degrades blank strings and non-strings to null', () => {
    expect(normalizeRevision('')).toBeNull()
    expect(normalizeRevision('   ')).toBeNull()
    expect(normalizeRevision(null)).toBeNull()
    expect(normalizeRevision(undefined)).toBeNull()
    expect(normalizeRevision(42)).toBeNull()
  })
})

describe('effectiveRevision (runtime override gating, research R4)', () => {
  it('honours a set runtime env var in unpackaged runs (dev/e2e seam)', () => {
    expect(effectiveRevision('baked123', 'runtime456', true)).toBe('runtime456')
    expect(effectiveRevision('baked123', '', true)).toBeNull()
  })

  it('ignores ambient env vars in packaged runs so releases cannot be falsified', () => {
    expect(effectiveRevision('baked123', 'runtime456', false)).toBe('baked123')
    expect(effectiveRevision(null, 'runtime456', false)).toBeNull()
  })

  it('falls back to the embedded value when no runtime override exists', () => {
    expect(effectiveRevision('baked123', undefined, true)).toBe('baked123')
    expect(effectiveRevision(undefined, undefined, true)).toBeNull()
  })
})

describe('currentBuildInfo (About trio composition)', () => {
  const savedEnv = process.env.MM_BUILD_COMMIT

  beforeEach(() => {
    delete process.env.MM_BUILD_COMMIT
  })

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.MM_BUILD_COMMIT
    else process.env.MM_BUILD_COMMIT = savedEnv
  })

  it('carries the exact repository constant and the given version', () => {
    const info = currentBuildInfo('1.2.1', true)
    expect(info.version).toBe('1.2.1')
    expect(info.repositoryUrl).toBe(REPOSITORY_URL)
    expect(REPOSITORY_URL).toBe('https://github.com/yetanotherchris/markdownmeister')
  })

  it('reports null revision under vitest (no embedded define, no env override)', () => {
    expect(currentBuildInfo('1.2.1', false).revision).toBeNull()
  })

  it('unpackaged runs honour MM_BUILD_COMMIT; packaged runs never do', () => {
    process.env.MM_BUILD_COMMIT = 'feedface'
    expect(currentBuildInfo('1.2.1', false).revision).toBe('feedface')
    expect(currentBuildInfo('1.2.1', true).revision).toBeNull()

    process.env.MM_BUILD_COMMIT = ''
    expect(currentBuildInfo('1.2.1', false).revision).toBeNull()
    expect(currentBuildInfo('1.2.1', true).revision).toBeNull()
  })
})
