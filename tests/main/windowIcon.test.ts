import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { windowIconPath } from '../../src/main/windowIcon'

/**
 * Spec 039/049: the BrowserWindow icon resolves to the extraResources-shipped
 * copy (<install>/resources, i.e. process.resourcesPath) when packaged, never
 * to an __dirname-relative path that only works while resources/** rides
 * inside app.asar. Since spec 049 Windows serves the multi-size icon.ico;
 * Linux keeps the single PNG copy; macOS returns no path (the Dock icon comes
 * from the bundle icns).
 */

const join = (...parts: string[]): string => path.join(...parts)

describe('windowIconPath (spec 039/049 runtime window icon)', () => {
  it('packaged windows resolves to process.resourcesPath/icon.ico (extraResources destination)', () => {
    // Path.join applies host separators, so expectations are built with the same join.
    expect(
      windowIconPath({
        platform: 'win32',
        isPackaged: true,
        resourcesPath: join('C:', 'App', 'resources'),
        mainDir: join('C:', 'App', 'resources', 'app.asar', 'out', 'main')
      })
    ).toBe(join('C:', 'App', 'resources', 'icon.ico'))
  })

  it('dev windows (not packaged) resolves relative to out/main up to the repo resources dir', () => {
    const mainDir = join('C:', 'repo', 'markdownmeister', 'out', 'main')
    expect(
      windowIconPath({ platform: 'win32', isPackaged: false, resourcesPath: '', mainDir })
    ).toBe(join(mainDir, '..', '..', 'resources', 'icon.ico'))
  })

  it('packaged linux keeps the extraResources png copy', () => {
    expect(
      windowIconPath({
        platform: 'linux',
        isPackaged: true,
        resourcesPath: join('C:', 'App', 'resources'),
        mainDir: join('C:', 'App', 'resources', 'app.asar', 'out', 'main')
      })
    ).toBe(join('C:', 'App', 'resources', 'icon.png'))
  })

  it('dev linux resolves relative to out/main up to the repo resources dir', () => {
    const mainDir = join('C:', 'repo', 'markdownmeister', 'out', 'main')
    expect(
      windowIconPath({ platform: 'linux', isPackaged: false, resourcesPath: '', mainDir })
    ).toBe(join(mainDir, '..', '..', 'resources', 'icon.png'))
  })

  it('never returns a path on macOS: the Dock icon comes from the bundle icns', () => {
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
