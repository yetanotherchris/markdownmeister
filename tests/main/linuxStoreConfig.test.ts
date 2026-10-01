import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  SNAP_NAME,
  isSemver,
  assertSemver,
  normaliseTag,
  assertVersionMatchesTag,
  isSnapArtifactName,
  assertSnapArtifactName,
  hasSnapCredentials
} from '../../scripts/linux-store-submission.mjs'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'linux-store-submission.mjs')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8').replaceAll('\r\n', '\n')
}

/** The indented block under a top-level `key:` in a YAML file. */
function yamlBlock(text: string, key: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trimEnd() === `${key}:`)
  if (start === -1) throw new Error(`top-level block "${key}" not found`)
  const block: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (index > start && line.length > 0 && !/^\s/.test(line)) break
    block.push(line)
  }
  return block.join('\n')
}

function runCli(args: string[]): void {
  execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf-8', stdio: 'pipe' })
}

const builder = read('electron-builder.yml')
const snap = yamlBlock(builder, 'snap')
const linux = yamlBlock(builder, 'linux')
const storeWorkflow = read('.github/workflows/build-linux-store.yml')
const releaseWorkflow = read('.github/workflows/build-release.yml')

describe('linux store submission: version and artifact gates', () => {
  it('accepts only a three-part version', () => {
    expect(isSemver('1.7.0')).toBe(true)
    for (const bad of ['1.7', '1.7.0.1', 'v1.7.0', '', '1.7.x']) {
      expect(isSemver(bad)).toBe(false)
      expect(() => assertSemver(bad)).toThrow(/major\.minor\.patch/)
    }
  })

  it('compares the version against the release tag, tolerating a leading v', () => {
    expect(normaliseTag('v1.7.0')).toBe('1.7.0')
    expect(() => assertVersionMatchesTag('1.7.0', 'v1.7.0')).not.toThrow()
    expect(() => assertVersionMatchesTag('1.7.0', '1.7.0')).not.toThrow()
    expect(() => assertVersionMatchesTag('1.7.0', 'v1.8.0')).toThrow(/does not match/)
    expect(() => assertVersionMatchesTag('1.7.0', '')).toThrow(/empty/)
  })

  it('recognises the snap artifact for a version and rejects others', () => {
    expect(isSnapArtifactName('markdownmeister-1.7.0-linux-x64.snap', '1.7.0')).toBe(true)
    expect(isSnapArtifactName('markdownmeister_1.7.0_amd64.snap', '1.7.0')).toBe(true)
    expect(isSnapArtifactName('markdownmeister-1.6.0-linux-x64.snap', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('other-1.7.0-linux-x64.snap', '1.7.0')).toBe(false)
    expect(isSnapArtifactName('markdownmeister-1.7.0-linux-x64.AppImage', '1.7.0')).toBe(false)
    expect(() => assertSnapArtifactName('markdownmeister-1.7.0-linux-x64.snap', '1.8.0')).toThrow(
      /not the markdownmeister snap/
    )
  })

  it('treats a blank or missing credential as absent', () => {
    expect(hasSnapCredentials({})).toBe(false)
    expect(hasSnapCredentials({ SNAPCRAFT_STORE_CREDENTIALS: '   ' })).toBe(false)
    expect(hasSnapCredentials({ SNAPCRAFT_STORE_CREDENTIALS: 'token' })).toBe(true)
  })
})

describe('linux store submission: CLI exit codes', () => {
  it('passes a valid version and tag', () => {
    expect(() => runCli(['validate', '--version', '1.7.0'])).not.toThrow()
    expect(() =>
      runCli(['assert-tag', '--version', '1.7.0', '--ref', 'v1.7.0'])
    ).not.toThrow()
    expect(() =>
      runCli(['check-artifact', '--name', 'markdownmeister-1.7.0-linux-x64.snap', '--version', '1.7.0'])
    ).not.toThrow()
  })

  it('fails closed on a bad version, a tag mismatch, and a missing credential', () => {
    expect(() => runCli(['validate', '--version', '1.7'])).toThrow()
    expect(() => runCli(['assert-tag', '--version', '1.7.0', '--ref', 'v1.8.0'])).toThrow()
    expect(() => runCli(['require-credentials'])).toThrow()
  })
})

describe('snap release configuration (FR-002, FR-003, FR-019)', () => {
  it('defines a strict, stable snap without adding it to the AppImage target', () => {
    expect(snap).toMatch(/confinement:\s*strict/)
    expect(snap).toMatch(/grade:\s*stable/)
    expect(linux).not.toMatch(/target:\s*snap/)
    expect(linux).not.toMatch(/-\s*target:\s*snap/)
  })

  it('carries a summary within the store limit and a description', () => {
    const summary = snap.match(/summary:\s*(.+)/)?.[1] ?? ''
    expect(summary.length).toBeGreaterThan(0)
    expect(summary.length).toBeLessThanOrEqual(78)
    expect(snap).toMatch(/description:\s*\|/)
  })

  it('declares no interface the app does not use', () => {
    // The plugs list is the tail of the snap block, so slice from its key.
    const plugs = snap.slice(snap.indexOf('plugs:'))
    expect(plugs).toContain('plugs:')
    for (const unused of ['network', 'audio-playback', 'pulseaudio', 'removable-media']) {
      expect(plugs).not.toMatch(new RegExp(`-\\s*${unused}\\b`))
    }
    for (const used of ['home', 'desktop', 'x11', 'wayland', 'opengl', 'browser-support']) {
      expect(plugs).toMatch(new RegExp(`-\\s*${used}\\b`))
    }
  })
})

describe('linux store workflow (FR-012, FR-013, FR-018)', () => {
  it('is a dispatched build with an optional, off-by-default publish', () => {
    expect(storeWorkflow).toContain('workflow_dispatch')
    expect(storeWorkflow).toMatch(/publish:[\s\S]*?default:\s*false/)
    expect(storeWorkflow).toContain('node scripts/linux-store-submission.mjs validate')
    expect(storeWorkflow).toContain('assert-tag')
  })

  it('selects the snap target on the command line and never publishes without a credential', () => {
    expect(storeWorkflow).toContain('--linux snap --x64')
    expect(storeWorkflow).toMatch(/if:\s*\$\{\{\s*inputs\.publish\s*\}\}/)
    expect(storeWorkflow).toContain('secrets.SNAPCRAFT_STORE_CREDENTIALS')
    expect(storeWorkflow).toContain('require-credentials')
    expect(storeWorkflow).not.toMatch(/SNAPCRAFT_STORE_CREDENTIALS:\s*[A-Za-z0-9+/=]{20,}/)
  })

  it('pins every action to a full commit SHA with a version comment', () => {
    const uses = [...storeWorkflow.matchAll(/uses:\s*(actions\/[a-z-]+)@([0-9a-f]{40})\s*#[^\n]*v\d+/g)]
    expect(uses.length).toBeGreaterThan(0)
    for (const [, name] of uses) expect(name).toMatch(/^actions\//)
  })

  it('keeps the store build out of the direct-download release path', () => {
    expect(releaseWorkflow).not.toContain('--linux snap')
    expect(releaseWorkflow).not.toContain('snapcraft')
    expect(storeWorkflow).not.toContain('softprops/action-gh-release')
    expect(storeWorkflow).not.toMatch(/updatescoop|updatebrew|updatepackagejson/)
  })
})

describe('linux channel identity (FR-017)', () => {
  it('keeps the AppImage desktop entry AppImage-only and distinct from the snap name', () => {
    const index = read('src/main/index.ts')
    expect(index).toMatch(/process\.platform !== 'linux' \|\| !process\.env\.APPIMAGE/)

    const desktopEntry = read('src/main/linuxDesktopEntry.ts')
    const entryName = desktopEntry.match(/DESKTOP_ENTRY_FILE_NAME = '([^']+)'/)?.[1]
    expect(entryName).toBe('markdownmeister.desktop')
    expect(SNAP_NAME).toBe('markdownmeister')
    // The store config must not take over the AppImage entry's name.
    expect(builder).not.toContain('syncDesktopName')
  })

  it('advertises both Linux stores with their real links', () => {
    const readme = read('README.md')
    expect(readme).toContain('sudo snap install markdownmeister')
    expect(readme).toContain('https://flathub.org/apps/io.github.yetanotherchris.MarkdownMeister')
    const content = read('docs/site/src/content.ts')
    expect(content).toContain('https://snapcraft.io/markdownmeister')
    expect(content).toContain('https://flathub.org/apps/io.github.yetanotherchris.MarkdownMeister')
  })
})
