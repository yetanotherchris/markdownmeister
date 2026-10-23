import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { artifactNames } from './verify-macos-artifacts.mjs'

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 300_000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
}

export function packageArtifacts({ artifactsDir, version, arch }) {
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported macOS architecture: ${arch}`)
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid release version: ${version}`)

  const output = resolve(artifactsDir)
  const appPath = join(output, arch === 'arm64' ? 'mac-arm64' : 'mac', 'markdownmeister.app')
  if (!existsSync(appPath)) throw new Error(`Missing packaged application: ${appPath}`)

  const names = artifactNames(version, arch)
  const dmgPath = join(output, names.dmg)
  const zipPath = join(output, names.zip)
  if (existsSync(dmgPath) || existsSync(zipPath)) {
    throw new Error('Release archives already exist; use a clean output directory')
  }

  run('/usr/bin/lipo', [
    '-verify_arch',
    arch === 'x64' ? 'x86_64' : 'arm64',
    join(appPath, 'Contents', 'MacOS', 'markdownmeister')
  ])

  const staging = mkdtempSync(join(tmpdir(), 'markdownmeister-package-'))
  try {
    run('/usr/bin/ditto', [appPath, join(staging, 'markdownmeister.app')])
    symlinkSync('/Applications', join(staging, 'Applications'))
    run('/usr/bin/hdiutil', [
      'create',
      '-srcfolder',
      staging,
      '-volname',
      `MarkdownMeister ${version}`,
      '-fs',
      'HFS+',
      '-format',
      'UDZO',
      dmgPath
    ])
    run('/usr/bin/hdiutil', ['verify', dmgPath])
    run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath])
  } catch (error) {
    rmSync(dmgPath, { force: true })
    rmSync(zipPath, { force: true })
    throw error
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || !process.argv[index + 1])
    throw new Error(`Missing required argument: ${name}`)
  return process.argv[index + 1]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'darwin') throw new Error('macOS archive creation requires a macOS host')
  packageArtifacts({
    artifactsDir: readArgument('--artifacts-dir'),
    version: readArgument('--version'),
    arch: readArgument('--arch')
  })
}
