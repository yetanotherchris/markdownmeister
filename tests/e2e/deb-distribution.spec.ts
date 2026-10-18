import { test, expect, _electron as electron } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

const exec = promisify(execFile)
const VERSION = '9.8.7'

test('the Debian package has release metadata, a launcher, and a working versioned app', async () => {
  test.skip(process.platform !== 'linux', 'Debian packages are built and launched on Linux')
  test.setTimeout(300_000)

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-deb-'))
  try {
    execFileSync(
      process.execPath,
      [
        'node_modules/electron-builder/cli.js',
        '--linux',
        'deb',
        '--x64',
        '--publish',
        'never',
        `--config.extraMetadata.version=${VERSION}`,
        `--config.directories.output=${directory}`
      ],
      { timeout: 240_000, stdio: 'inherit' }
    )

    const artifact = path.join(directory, `markdownmeister_${VERSION}_amd64.deb`)
    expect((await fs.stat(artifact)).size).toBeGreaterThan(0)
    const { stdout: metadata } = await exec('dpkg-deb', ['--field', artifact])
    expect(metadata).toMatch(/^Package: markdownmeister$/m)
    expect(metadata).toMatch(new RegExp(`^Version: ${VERSION.replaceAll('.', '\\.')}$`, 'm'))
    expect(metadata).toMatch(/^Architecture: amd64$/m)
    expect(metadata).toMatch(/^Maintainer: Chris S\. <github@yetanotherchris\.dev>$/m)
    expect(metadata).toMatch(
      /^Homepage: https:\/\/yetanotherchris\.github\.io\/markdownmeister\/$/m
    )
    expect(metadata).toMatch(/^Section: editors$/m)
    expect(metadata).toMatch(/^Depends: .*(?:libgtk-3-0|libgtk-3-0t64)/m)

    const extracted = path.join(directory, 'extracted')
    await exec('dpkg-deb', ['--extract', artifact, extracted])
    const desktop = await fs.readFile(
      path.join(extracted, 'usr/share/applications/markdownmeister.desktop'),
      'utf-8'
    )
    expect(desktop).toContain('Name=MarkdownMeister')
    expect(desktop).toMatch(/^Exec=.*\/markdownmeister/m)
    expect(desktop).toMatch(/^Categories=.*Office/m)

    const app = await electron.launch({
      executablePath: path.join(extracted, 'opt/MarkdownMeister/markdownmeister'),
      args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${path.join(directory, 'profile')}`],
      timeout: 30_000
    })
    try {
      await expect(
        (await app.firstWindow()).getByRole('button', { name: 'Open menu' })
      ).toBeVisible()
      expect(await app.evaluate(({ app: packagedApp }) => packagedApp.getVersion())).toBe(VERSION)
    } finally {
      await app.close()
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
