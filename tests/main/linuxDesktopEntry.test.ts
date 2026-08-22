import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  renderDesktopEntry,
  resolveXdgDataHome,
  ensureFolderAction,
  removeFolderAction,
  folderActionLocations
} from '../../src/main/linuxDesktopEntry'

let dataHome: string

beforeEach(() => {
  dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-desktop-entry-'))
})

afterEach(() => {
  fs.rmSync(dataHome, { recursive: true, force: true })
})

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d
])

function writeIconSource(dir: string): string {
  const iconSource = path.join(dir, 'source-icon.png')
  fs.writeFileSync(iconSource, PNG_BYTES)
  return iconSource
}

describe('resolveXdgDataHome', () => {
  it('prefers an absolute XDG_DATA_HOME', () => {
    expect(
      resolveXdgDataHome({ XDG_DATA_HOME: '/xdg/data', HOME: '/home/user' })
    ).toBe('/xdg/data')
  })

  it('falls back to $HOME/.local/share', () => {
    expect(resolveXdgDataHome({ HOME: '/home/user' })).toBe(
      path.join('/home/user', '.local', 'share')
    )
  })

  it('ignores a relative XDG_DATA_HOME and uses the home fallback', () => {
    expect(
      resolveXdgDataHome({ XDG_DATA_HOME: 'relative/data', HOME: '/home/user' })
    ).toBe(path.join('/home/user', '.local', 'share'))
  })

  it('returns null when neither XDG_DATA_HOME nor HOME resolves', () => {
    expect(resolveXdgDataHome({})).toBeNull()
    expect(resolveXdgDataHome({ HOME: 'not/absolute' })).toBeNull()
  })
})

describe('folderActionLocations', () => {
  it('derives the applications entry and hicolor icon paths from the data home', () => {
    const locations = folderActionLocations(dataHome)
    expect(locations.entryFile).toBe(
      path.join(dataHome, 'applications', 'markdownmeister.desktop')
    )
    expect(locations.iconFile).toBe(
      path.join(dataHome, 'icons', 'hicolor', '256x256', 'apps', 'markdownmeister.png')
    )
  })
})

describe('renderDesktopEntry', () => {
  it('renders the fixed keys with a quoted Exec and bare TryExec', () => {
    const content = renderDesktopEntry('/opt/apps/MarkdownMeister.AppImage')
    expect(content).toContain('[Desktop Entry]\n')
    expect(content).toContain('Type=Application\n')
    expect(content).toContain(`Name=MarkdownMeister\n`)
    expect(content).toContain('Exec="/opt/apps/MarkdownMeister.AppImage" %f\n')
    expect(content).toContain('TryExec=/opt/apps/MarkdownMeister.AppImage\n')
    expect(content).toContain('MimeType=inode/directory;\n')
    expect(content).not.toContain('Icon=')
  })

  it('references the installed icon by name when one is present', () => {
    const content = renderDesktopEntry('/opt/app.AppImage', {
      iconName: 'markdownmeister'
    })
    expect(content).toContain('Icon=markdownmeister\n')
  })

  it.each([
    ['/home/user/my apps/MarkdownMeister.AppImage'],
    ['/home/user/üser/我的笔记.AppImage'],
    ['/tmp/.mount_0001/markdown meister (beta).AppImage']
  ])('keeps hostile paths intact through quoting: %s', appImagePath => {
    const content = renderDesktopEntry(appImagePath)
    expect(content).toContain(`Exec="${appImagePath}" %f\n`)
    expect(content).toContain(`TryExec=${appImagePath}\n`)
  })

  it('escapes double quotes in the quoted Exec argument per the desktop-entry spec', () => {
    const content = renderDesktopEntry('/op"t/app.AppImage')
    expect(content).toContain('Exec="/op\\"t/app.AppImage" %f\n')
  })

  it('escapes backslashes and literal percent signs in the Exec argument', () => {
    const content = renderDesktopEntry('/we\\ird%path/app.AppImage')
    expect(content).toContain('Exec="/we\\\\ird%%path/app.AppImage" %f\n')
  })
})

describe('ensureFolderAction', () => {
  it('writes the entry and icon into a redirected data home', () => {
    const iconSource = writeIconSource(dataHome)

    const outcome = ensureFolderAction({
      locations: folderActionLocations(dataHome),
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.iconInstalled).toBe(true)
    const entry = fs.readFileSync(
      path.join(dataHome, 'applications', 'markdownmeister.desktop'),
      'utf-8'
    )
    expect(entry).toContain('Exec="/opt/apps/MarkdownMeister.AppImage" %f\n')
    expect(entry).toContain('Icon=markdownmeister\n')
    expect(fs.readFileSync(path.join(dataHome, 'icons', 'hicolor', '256x256', 'apps', 'markdownmeister.png'))).toEqual(PNG_BYTES)
  })

  it('is idempotent when nothing changed', () => {
    const locations = folderActionLocations(dataHome)
    const first = ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage'
    })
    const before = fs.statSync(locations.entryFile).mtimeMs

    const second = ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage'
    })

    expect(first.ok && second.ok).toBe(true)
    expect(second.ok ? second.changed : null).toBe(false)
    expect(fs.statSync(locations.entryFile).mtimeMs).toBe(before)
  })

  it('rewrites the entry when the AppImage moves', () => {
    const locations = folderActionLocations(dataHome)
    ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage'
    })

    const moved = ensureFolderAction({
      locations,
      appImagePath: '/new/place/MarkdownMeister.AppImage'
    })

    expect(moved.ok && moved.changed).toBe(true)
    const entry = fs.readFileSync(locations.entryFile, 'utf-8')
    expect(entry).toContain('Exec="/new/place/MarkdownMeister.AppImage" %f\n')
    expect(entry).not.toContain('/opt/apps/')
  })

  it('skips an unreadable icon source without failing the entry write', () => {
    const outcome = ensureFolderAction({
      locations: folderActionLocations(dataHome),
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource: path.join(dataHome, 'does-not-exist.png')
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.iconInstalled).toBe(false)
    const entry = fs.readFileSync(path.join(dataHome, 'applications', 'markdownmeister.desktop'), 'utf-8')
    expect(entry).not.toContain('Icon=')
  })

  it('rejects an icon source that is not a PNG', () => {
    const notPng = path.join(dataHome, 'fake.png')
    fs.writeFileSync(notPng, '<svg/>')

    const outcome = ensureFolderAction({
      locations: folderActionLocations(dataHome),
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource: notPng
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.iconInstalled).toBe(false)
  })

  it('fails soft when the applications directory cannot be created', () => {
    // Occupy the `applications` path itself with a FILE so the recursive mkdir
    // of the entry's parent fails cross-platform.
    const blocked = folderActionLocations(dataHome)
    fs.writeFileSync(path.dirname(blocked.entryFile), 'not a directory')

    const outcome = ensureFolderAction({
      locations: blocked,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage'
    })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(typeof outcome.message).toBe('string')
    expect(outcome.message.length).toBeGreaterThan(0)
  })
})

describe('removeFolderAction', () => {
  it('deletes both files and reports what was removed', () => {
    const locations = folderActionLocations(dataHome)
    ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource: writeIconSource(dataHome)
    })

    const outcome = removeFolderAction(locations)

    expect(outcome.removedEntry).toBe(true)
    expect(outcome.removedIcon).toBe(true)
    expect(fs.existsSync(locations.entryFile)).toBe(false)
    expect(fs.existsSync(locations.iconFile)).toBe(false)
  })

  it('succeeds when the files are absent', () => {
    const outcome = removeFolderAction(folderActionLocations(dataHome))
    expect(outcome.removedEntry).toBe(false)
    expect(outcome.removedIcon).toBe(false)
  })

  it('never touches mimeapps.list', () => {
    const locations = folderActionLocations(dataHome)
    fs.mkdirSync(path.dirname(locations.entryFile), { recursive: true })
    const mimeapps = path.join(path.dirname(locations.entryFile), 'mimeapps.list')
    fs.writeFileSync(mimeapps, '[Default Applications]\ninode/directory=org.other.desktop\n')

    removeFolderAction(locations)

    expect(fs.readFileSync(mimeapps, 'utf-8')).toContain('[Default Applications]')
  })
})
