import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  renderDesktopEntry,
  resolveXdgDataHome,
  ensureFolderAction,
  removeFolderAction,
  folderActionLocations,
  findAppImageIcon
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
    expect(resolveXdgDataHome({ XDG_DATA_HOME: '/xdg/data', HOME: '/home/user' })).toBe('/xdg/data')
  })

  it('falls back to $HOME/.local/share', () => {
    expect(resolveXdgDataHome({ HOME: '/home/user' })).toBe(
      path.join('/home/user', '.local', 'share')
    )
  })

  it('ignores a relative XDG_DATA_HOME and uses the home fallback', () => {
    expect(resolveXdgDataHome({ XDG_DATA_HOME: 'relative/data', HOME: '/home/user' })).toBe(
      path.join('/home/user', '.local', 'share')
    )
  })

  it('returns null when neither XDG_DATA_HOME nor HOME resolves', () => {
    expect(resolveXdgDataHome({})).toBeNull()
    expect(resolveXdgDataHome({ HOME: 'not/absolute' })).toBeNull()
  })
})

describe('folderActionLocations', () => {
  it('derives the applications entry and hicolor icon paths from the data home', () => {
    const locations = folderActionLocations(dataHome)
    expect(locations.entryFile).toBe(path.join(dataHome, 'applications', 'markdownmeister.desktop'))
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
  ])('keeps hostile paths intact through quoting: %s', (appImagePath) => {
    const content = renderDesktopEntry(appImagePath)
    expect(content).toContain(`TryExec=${appImagePath}\n`)
    expect(parseExecPath(content)).toBe(appImagePath)
    expect(parseTryExecPath(content)).toBe(appImagePath)
  })

  it('escapes double quotes through both escape layers per the desktop-entry spec', () => {
    const content = renderDesktopEntry('/op"t/app.AppImage')
    expect(content).toContain('Exec="/op\\\\"t/app.AppImage" %f\n')
  })

  it('escapes backslashes and literal percent signs through both escape layers', () => {
    const content = renderDesktopEntry('/we\\ird%path/app.AppImage')
    expect(content).toContain('Exec="/we\\\\\\\\ird%%path/app.AppImage" %f\n')
  })

  it('rejects an empty application image path', () => {
    const outcome = ensureFolderAction({
      locations: folderActionLocations(dataHome),
      appImagePath: ''
    })
    expect(outcome.ok).toBe(false)
  })
})

/**
 * Inverse of the module's two-layer Exec encoding (file-layer string escapes,
 * then the Exec-layer quoted argument with `%%` field-code escapes), proving
 * hostile paths survive a write → strict-parse round trip.
 */
function unescapeBackslashes(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      out += input[i + 1]
      i++
    } else {
      out += input[i]
    }
  }
  return out
}

function parseExecPath(content: string): string {
  const line = content.split('\n').find((candidate) => candidate.startsWith('Exec=')) ?? ''
  const quoted = unescapeBackslashes(line.slice('Exec='.length))
  const match = quoted.match(/^"(.*)" %f$/)
  if (!match) throw new Error(`Unparseable Exec line: ${line}`)
  return unescapeBackslashes(match[1]).replace(/%%/g, '%')
}

function parseTryExecPath(content: string): string {
  const line = content.split('\n').find((candidate) => candidate.startsWith('TryExec=')) ?? ''
  return unescapeBackslashes(line.slice('TryExec='.length))
}

describe('findAppImageIcon', () => {
  it('prefers the .DirIcon at the mount root', () => {
    fs.writeFileSync(path.join(dataHome, '.DirIcon'), PNG_BYTES)
    expect(findAppImageIcon(dataHome)).toBe(path.join(dataHome, '.DirIcon'))
  })

  it('falls back to a root-level icon file named for the app', () => {
    fs.writeFileSync(path.join(dataHome, 'markdownmeister.png'), PNG_BYTES)
    expect(findAppImageIcon(dataHome)).toBe(path.join(dataHome, 'markdownmeister.png'))
  })

  it('finds the icon inside a usr/share/icons hicolor tree', () => {
    const hicolorIcon = path.join(
      dataHome,
      'usr',
      'share',
      'icons',
      'hicolor',
      '512x512',
      'apps',
      'markdownmeister.png'
    )
    fs.mkdirSync(path.dirname(hicolorIcon), { recursive: true })
    fs.writeFileSync(hicolorIcon, PNG_BYTES)
    expect(findAppImageIcon(dataHome)).toBe(hicolorIcon)
  })

  it('prefers larger hicolor sizes regardless of directory order', () => {
    const small = path.join(
      dataHome,
      'usr',
      'share',
      'icons',
      'hicolor',
      '16x16',
      'apps',
      'markdownmeister.png'
    )
    const large = path.join(
      dataHome,
      'usr',
      'share',
      'icons',
      'hicolor',
      '512x512',
      'apps',
      'markdownmeister.png'
    )
    fs.mkdirSync(path.dirname(small), { recursive: true })
    fs.mkdirSync(path.dirname(large), { recursive: true })
    fs.writeFileSync(small, PNG_BYTES)
    fs.writeFileSync(large, PNG_BYTES)
    expect(findAppImageIcon(dataHome)).toBe(large)
  })

  it('returns null when nothing PNG-shaped exists', () => {
    expect(findAppImageIcon(dataHome)).toBeNull()
    const notPng = path.join(dataHome, '.DirIcon')
    fs.writeFileSync(notPng, '<svg/>')
    expect(findAppImageIcon(dataHome)).toBeNull()
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
    const installedIcon = fs.readFileSync(
      path.join(dataHome, 'icons', 'hicolor', '256x256', 'apps', 'markdownmeister.png')
    )
    expect(installedIcon).toEqual(PNG_BYTES)
  })

  it('does not recopy an identical icon on a later launch', () => {
    const iconSource = writeIconSource(dataHome)
    const locations = folderActionLocations(dataHome)
    ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource
    })
    const before = fs.statSync(locations.iconFile).mtimeMs

    const second = ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource
    })

    expect(second.ok && second.iconInstalled).toBe(true)
    expect(fs.statSync(locations.iconFile).mtimeMs).toBe(before)
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
    const entry = fs.readFileSync(
      path.join(dataHome, 'applications', 'markdownmeister.desktop'),
      'utf-8'
    )
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

  it('treats a directory as a missing icon source rather than failing', () => {
    const outcome = ensureFolderAction({
      locations: folderActionLocations(dataHome),
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource: dataHome
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.iconInstalled).toBe(false)
    expect(fs.existsSync(path.join(dataHome, 'icons'))).toBe(false)
  })

  it('rewrites without the Icon key when the icon source disappears, tolerating the stale file', () => {
    const locations = folderActionLocations(dataHome)
    ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage',
      iconSource: writeIconSource(dataHome)
    })

    const second = ensureFolderAction({
      locations,
      appImagePath: '/opt/apps/MarkdownMeister.AppImage'
    })

    expect(second.ok && second.iconInstalled).toBe(false)
    expect(fs.readFileSync(locations.entryFile, 'utf-8')).not.toContain('Icon=')
    // The orphaned hicolor PNG is tolerated: nothing references or displays it.
    expect(fs.existsSync(locations.iconFile)).toBe(true)
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
