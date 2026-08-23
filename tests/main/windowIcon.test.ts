import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { windowIconPath } from '../../src/main/windowIcon'

/**
 * Spec 039 (research D3, PR #73 review finding): the BrowserWindow icon must
 * resolve to the extraResources-shipped copy (<install>/resources/icon.png,
 * i.e. process.resourcesPath) when packaged — never to an __dirname-relative
 * path that only works while resources/** rides inside app.asar.
 */

const join = (...parts: string[]): string => path.join(...parts)

describe('windowIconPath (spec 039 runtime window icon)', () => {
  it('packaged resolves to process.resourcesPath/icon.png (extraResources destination)', () => {
    // One shared branch serves every non-macOS platform; path.join applies
    // host separators, so expectations are built with the same join.
    expect(
      windowIconPath({
        platform: process.platform,
        isPackaged: true,
        resourcesPath: join('C:', 'App', 'resources'),
        mainDir: join('C:', 'App', 'resources', 'app.asar', 'out', 'main')
      })
    ).toBe(join('C:', 'App', 'resources', 'icon.png'))
  })

  it('dev (not packaged) resolves relative to out/main up to the repo resources dir', () => {
    const mainDir = join('C:', 'repo', 'markdownmeister', 'out', 'main')
    expect(
      windowIconPath({ platform: process.platform, isPackaged: false, resourcesPath: '', mainDir })
    ).toBe(join(mainDir, '..', '..', 'resources', 'icon.png'))
  })

  it('never returns a path on macOS — the Dock icon comes from the bundle icns', () => {
    for (const isPackaged of [false, true]) {
      expect(
        windowIconPath({
          platform: 'darwin',
          isPackaged,
          resourcesPath: join('C:', 'App', 'resources'),
          mainDir: join('C:', 'App', 'resources', 'app.asar', 'out', 'main')
        })
      ).toBeUndefined()
    }
  })
})
