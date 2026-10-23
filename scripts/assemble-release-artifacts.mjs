import { constants, copyFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function assembleArtifacts({ downloadsDir, artifactsDir, version }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid release version: ${version}`)

  const expected = new Map([
    [
      'artifacts-windows-x64',
      [`markdownmeister-${version}-windows-x64.exe`, `markdownmeister-${version}-windows-x64.zip`]
    ],
    [
      'artifacts-macos-x64',
      [`markdownmeister-${version}-macos-x64.dmg`, `markdownmeister-${version}-macos-x64.zip`]
    ],
    [
      'artifacts-macos-arm64',
      [`markdownmeister-${version}-macos-arm64.dmg`, `markdownmeister-${version}-macos-arm64.zip`]
    ],
    [
      'artifacts-linux-x64',
      [`markdownmeister-${version}-linux-x64.AppImage`, `markdownmeister_${version}_amd64.deb`]
    ]
  ])
  const sources = new Map()
  for (const group of readdirSync(downloadsDir)) {
    const directory = join(downloadsDir, group)
    if (!expected.has(group) || !lstatSync(directory).isDirectory()) {
      throw new Error(`Unexpected build artifact: ${group}`)
    }
    for (const name of readdirSync(directory)) {
      if (sources.has(name)) throw new Error(`Duplicate release artifact: ${name}`)
      if (!expected.get(group).includes(name))
        throw new Error(`Unexpected release artifact: ${group}/${name}`)
      const source = join(directory, name)
      const stat = lstatSync(source)
      if (!stat.isFile() || stat.size === 0)
        throw new Error(`Invalid or empty release artifact: ${name}`)
      sources.set(name, source)
    }
  }
  for (const names of expected.values()) {
    for (const name of names) {
      if (!sources.has(name)) throw new Error(`Missing release artifact: ${name}`)
    }
  }

  mkdirSync(artifactsDir)
  for (const [name, source] of sources) {
    copyFileSync(source, join(artifactsDir, name), constants.COPYFILE_EXCL)
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || !process.argv[index + 1])
    throw new Error(`Missing required argument: ${name}`)
  return process.argv[index + 1]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assembleArtifacts({
    downloadsDir: readArgument('--downloads-dir'),
    artifactsDir: readArgument('--artifacts-dir'),
    version: readArgument('--version')
  })
}
