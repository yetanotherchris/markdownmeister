// Spec 064: submission gates for the Linux store channels.
//
// The Linux store workflow runs these before and after packaging: `validate`
// checks the dispatched version, `assert-tag` checks it equals the release tag,
// `check-artifact` checks the produced .snap is named for that version, and
// `require-credentials` stops a publish that has no store credential. Every
// command fails closed with a non-zero exit. Nothing here writes a credential
// to disk; the secret is only read from the environment to decide whether a
// publish may proceed.

import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SNAP_NAME = 'markdownmeister'
const SEMVER = /^\d+\.\d+\.\d+$/

/** True when `version` is a plain three-part release version. */
export function isSemver(version) {
  return SEMVER.test((version ?? '').trim())
}

export function assertSemver(version) {
  if (!isSemver(version)) throw new Error(`version "${version}" must be major.minor.patch`)
}

/** The tag without a leading `v`, for comparison with a version. */
export function normaliseTag(ref) {
  return (ref ?? '').trim().replace(/^v/, '')
}

export function assertVersionMatchesTag(version, ref) {
  const tag = normaliseTag(ref)
  if (tag === '') throw new Error('the release tag is empty')
  if (tag !== (version ?? '').trim()) {
    throw new Error(`version ${version} does not match the release tag ${ref}`)
  }
}

/**
 * True when `name` is the `.snap` artifact electron-builder produces for this
 * app at `version`. The `linux.artifactName` pattern is inherited by the snap
 * target, so the file is `markdownmeister-<version>-linux-x64.snap`, but the
 * check accepts any `<SNAP_NAME>...<version>....snap` name so a future pattern
 * change does not silently pass a wrong artifact.
 */
export function isSnapArtifactName(name, version) {
  const file = path.basename((name ?? '').trim())
  return (
    file.startsWith(`${SNAP_NAME}`) &&
    file.endsWith('.snap') &&
    file.includes((version ?? '').trim())
  )
}

export function assertSnapArtifactName(name, version) {
  if (!isSnapArtifactName(name, version)) {
    throw new Error(`"${name}" is not the ${SNAP_NAME} snap for version ${version}`)
  }
}

/** True when a Snap Store credential is present in the environment. */
export function hasSnapCredentials(env) {
  return (
    typeof env?.SNAPCRAFT_STORE_CREDENTIALS === 'string' &&
    env.SNAPCRAFT_STORE_CREDENTIALS.trim() !== ''
  )
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]
    if (!flag?.startsWith('--')) throw new Error(`unexpected argument "${flag}"`)
    args[flag.slice(2)] = argv[i + 1] ?? ''
  }
  return args
}

function fail(message) {
  process.stderr.write(`linux-store-submission: ${message}\n`)
  process.exit(1)
}

const thisFile = fileURLToPath(import.meta.url)
const isEntry =
  typeof process.argv[1] === 'string' &&
  process.argv[1].length > 0 &&
  path.resolve(process.argv[1]) === thisFile

if (isEntry) {
  try {
    const [command, ...rest] = process.argv.slice(2)
    const args = parseArgs(rest)
    if (command === 'validate') {
      assertSemver(args.version)
      process.stdout.write(`linux-store-submission: version ${args.version} is well formed\n`)
    } else if (command === 'assert-tag') {
      assertVersionMatchesTag(args.version, args.ref)
      process.stdout.write(`linux-store-submission: version matches tag ${args.ref}\n`)
    } else if (command === 'check-artifact') {
      assertSemver(args.version)
      assertSnapArtifactName(args.name, args.version)
      process.stdout.write(
        `linux-store-submission: artifact ${args.name} is version ${args.version}\n`
      )
    } else if (command === 'require-credentials') {
      if (!hasSnapCredentials(process.env)) {
        fail('no Snap Store credential is set (SNAPCRAFT_STORE_CREDENTIALS)')
      }
      process.stdout.write('linux-store-submission: Snap Store credential is present\n')
    } else {
      fail(`unknown command "${command}"`)
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}
