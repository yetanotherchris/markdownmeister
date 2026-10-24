import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const QUARANTINE_ATTRIBUTE = 'com.apple.quarantine'
const QUARANTINE_VALUE = '0081;00000000;MarkdownMeister;'

export function artifactNames(version, arch) {
  return {
    dmg: `markdownmeister-${version}-macos-${arch}.dmg`,
    zip: `markdownmeister-${version}-macos-${arch}.zip`
  }
}

export function validationCommands(appPath) {
  return [
    ['codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]],
    ['xcrun', ['stapler', 'validate', appPath]],
    ['spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]],
    ['codesign', ['--display', '--verbose=4', appPath]]
  ]
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return `${result.stdout}\n${result.stderr}`
}

function applyQuarantine(target) {
  run('xattr', ['-w', QUARANTINE_ATTRIBUTE, QUARANTINE_VALUE, target])
}

function findApp(directory) {
  const app = readdirSync(directory, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.endsWith('.app')
  )
  if (!app) throw new Error(`No application bundle found in ${directory}`)
  return join(directory, app.name)
}

function verifyApp(appPath, identity) {
  for (const [command, args] of validationCommands(appPath)) run(command, args)
  const signingDetails = run('codesign', ['--display', '--verbose=4', appPath])
  const prefix = 'Developer ID Application:'
  const name = identity.trim()
  const authority = name.startsWith(prefix) ? name : `${prefix} ${name}`
  if (!signingDetails.split(/\r?\n/).includes(`Authority=${authority}`)) {
    throw new Error(`Expected Developer ID identity ${identity} was not found in ${appPath}`)
  }
  if (!signingDetails.includes('Runtime Version=')) {
    throw new Error(`Hardened runtime is not enabled for ${appPath}`)
  }
}

function verifyDmg(dmgPath, identity) {
  run('hdiutil', ['verify', dmgPath])
  const mountPoint = mkdtempSync(join(tmpdir(), 'markdownmeister-dmg-'))
  let mounted = false
  applyQuarantine(dmgPath)
  try {
    run('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountPoint])
    mounted = true
    verifyApp(findApp(mountPoint), identity)
  } finally {
    try {
      if (mounted) run('hdiutil', ['detach', mountPoint])
    } finally {
      rmSync(mountPoint, { force: true, recursive: true })
    }
  }
}

function verifyZip(zipPath, identity) {
  const extractionPath = mkdtempSync(join(tmpdir(), 'markdownmeister-zip-'))
  applyQuarantine(zipPath)
  try {
    run('ditto', ['-x', '-k', zipPath, extractionPath])
    verifyApp(findApp(extractionPath), identity)
  } finally {
    rmSync(extractionPath, { force: true, recursive: true })
  }
}

export function verifyArtifacts({ artifactsDir, version, arch, identity }) {
  const names = artifactNames(version, arch)
  const dmgPath = resolve(artifactsDir, names.dmg)
  const zipPath = resolve(artifactsDir, names.zip)
  if (!existsSync(dmgPath)) throw new Error(`Missing final DMG artifact: ${names.dmg}`)
  if (!existsSync(zipPath)) throw new Error(`Missing final ZIP artifact: ${names.zip}`)

  verifyDmg(dmgPath, identity)
  verifyZip(zipPath, identity)
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || !process.argv[index + 1])
    throw new Error(`Missing required argument: ${name}`)
  return process.argv[index + 1]
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  verifyArtifacts({
    artifactsDir: readArgument('--artifacts-dir'),
    version: readArgument('--version'),
    arch: readArgument('--arch'),
    identity: readArgument('--identity')
  })
}
