import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { classifyOsTarget, extractTargetFromArgv } from '../../src/main/osOpen'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Spec 038 FR-004/FR-005 parity: invoking the folder action through the MSIX
 * execution alias (markdownmeister.exe "<folder>") and through the classic
 * registry verb ("<exe>" "%1") produce the SAME argv shape, so both must flow
 * through the identical extraction → classification pipeline with identical
 * outcomes. Adversarial paths fail closed with path-free messages exactly as
 * they do for the classic entry (Principle II, constitution V).
 */

const ALIAS_PATH = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'Microsoft',
  'WindowsApps',
  'markdownmeister.exe'
)

function createTempDir(): string {
  const dir = path.join(os.tmpdir(), `mm-storehandoff-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

describe('alias vs classic verb argv parity', () => {
  let dir: string
  let folder: string
  beforeEach(() => {
    dir = createTempDir()
    fs.writeFileSync(path.join(dir, 'note.md'), '# Note')
    folder = path.join(dir, 'workspace')
    fs.mkdirSync(folder)
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('extracts the identical target from both invocation shapes', () => {
    // Classic verb: "<installed exe>" "%1"
    const verbArgv = [path.join('C:', 'Program Files', 'MarkdownMeister', 'markdownmeister.exe'), folder]
    // Alias invocation: the WindowsApps alias shim plus the same argument.
    const aliasArgv = [ALIAS_PATH, folder]
    expect(extractTargetFromArgv(verbArgv)).toBe(folder)
    expect(extractTargetFromArgv(aliasArgv)).toBe(folder)
  })

  it('classifies both shapes to the identical folder OsTarget', () => {
    const aliasArgv = [ALIAS_PATH, folder]
    const extracted = extractTargetFromArgv(aliasArgv)
    expect(extracted).not.toBeNull()

    const viaVerb = classifyOsTarget(folder)
    const viaAlias = classifyOsTarget(extracted as string)
    expect(viaAlias).toEqual(viaVerb)
    expect(viaAlias.ok).toBe(true)
    if (viaAlias.ok) {
      expect(viaAlias.target.kind).toBe('folder')
      expect(viaAlias.target.absPath).toBe(fs.realpathSync(folder))
    }
  })

  it('keeps the alias shape robust against loader/switch noise like the dev harness', () => {
    const noisy = [
      '/electron.exe',
      '-r',
      'node_modules/playwright-core/lib/server/electron/loader.js',
      '--headless',
      'out/main/index.js',
      folder
    ]
    expect(extractTargetFromArgv(noisy)).toBe(folder)
  })
})

describe('adversarial alias hand-offs fail closed', () => {
  let dir: string
  beforeEach(() => {
    dir = createTempDir()
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a folder deleted between menu display and invocation (US2 scenario 3)', () => {
    const gone = path.join(dir, 'vanished')
    fs.mkdirSync(gone)
    fs.rmSync(gone, { recursive: true })
    const result = classifyOsTarget(extractTargetFromArgv([ALIAS_PATH, gone]) as string)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/no longer available/)
      expect(result.message).not.toContain(gone)
    }
  })

  it('rejects a reserved device name without opening anything', () => {
    const device = '\\\\.\\CON'
    const result = classifyOsTarget(device)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).not.toContain(device)
  })

  it('rejects a non-string / empty hand-off', () => {
    expect(classifyOsTarget(undefined).ok).toBe(false)
    expect(classifyOsTarget('').ok).toBe(false)
  })

  it('never returns a target when the alias argv carries no absolute path', () => {
    expect(extractTargetFromArgv([ALIAS_PATH])).toBe(null)
    expect(extractTargetFromArgv([ALIAS_PATH, '--some-switch'])).toBe(null)
    expect(extractTargetFromArgv([ALIAS_PATH, 'relative/path'])).toBe(null)
  })

  it('hands a hostile but real folder name over verbatim to validation', () => {
    // Spaces, quotes are impossible in NTFS names; spaces + Unicode + dots are
    // not. The extension passes bytes verbatim; validation sees them verbatim.
    const hostile = path.join(dir, 'notes & drafts — v2.1 …文件夹')
    fs.mkdirSync(hostile)
    const extracted = extractTargetFromArgv([ALIAS_PATH, hostile])
    expect(extracted).toBe(hostile)
    const result = classifyOsTarget(extracted as string)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.target.absPath).toBe(fs.realpathSync(hostile))
  })
})
