// Spec 062: submission gates for the Microsoft Store package.
//
// The workflow runs this twice: `validate` before packaging (identity present
// and not a placeholder, version well formed and newer than the published one)
// and `validate-manifest` afterwards, against the AppxManifest.xml inside the
// produced .appx, so what Partner Center receives is checked, not what was
// intended. Everything fails closed with a non-zero exit.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PLACEHOLDER_IDENTITY_NAME = 'ReplaceWithPartnerCenterIdentity.MarkdownMeister'
export const PLACEHOLDER_PUBLISHER = 'CN=00000000-0000-0000-0000-000000000000'

const SEMVER = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/
const WINDOWS_VERSION = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})(?:\.(\d{1,5}))?$/

/** Human-readable reasons the identity cannot be submitted; empty means usable. */
export function identityProblems(identityName, publisher) {
  const name = (identityName ?? '').trim()
  const pub = (publisher ?? '').trim()
  const problems = []
  if (name === '') problems.push('the identity name is not set')
  else if (name === PLACEHOLDER_IDENTITY_NAME)
    problems.push('the identity name is still the committed placeholder')
  if (pub === '') problems.push('the publisher is not set')
  else if (pub === PLACEHOLDER_PUBLISHER)
    problems.push('the publisher is still the committed placeholder')
  return problems
}

export function isPlaceholderIdentity(identityName, publisher) {
  return identityProblems(identityName, publisher).length > 0
}

export function assertRealIdentity(identityName, publisher) {
  const problems = identityProblems(identityName, publisher)
  if (problems.length > 0) {
    throw new Error(`Store identity is not submittable: ${problems.join('; ')}`)
  }
}

/** Derives the four-part MSIX version. The revision must be 0 for a Store build. */
export function toWindowsVersion(version) {
  const match = SEMVER.exec((version ?? '').trim())
  if (!match) throw new Error(`version "${version}" must be major.minor.patch`)
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (major === 0) throw new Error(`version "${version}" must have a non-zero major part`)
  if ([major, minor, patch].some((part) => part > 65535)) {
    throw new Error(`version "${version}" has a part above 65535`)
  }
  return `${major}.${minor}.${patch}.0`
}

function parseWindowsVersion(version) {
  const match = WINDOWS_VERSION.exec((version ?? '').trim())
  if (!match) return null
  return [match[1], match[2], match[3], match[4] ?? '0'].map(Number)
}

/** -1, 0 or 1; accepts three- or four-part versions, treating revision as 0. */
export function compareWindowsVersions(a, b) {
  const left = parseWindowsVersion(a)
  const right = parseWindowsVersion(b)
  if (!left || !right) throw new Error(`cannot compare "${a}" with "${b}"`)
  for (let i = 0; i < 4; i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1
  }
  return 0
}

export function isVersionGreaterThan(version, publishedVersion) {
  if ((publishedVersion ?? '').trim() === '') return true
  return compareWindowsVersions(toWindowsVersion(version), publishedVersion) > 0
}

function readAttribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)
  return match ? match[1] : undefined
}

export function parseManifestIdentity(xml) {
  const tag = /<Identity\b[^>]*>/i.exec(xml ?? '')?.[0]
  if (!tag) throw new Error('AppxManifest.xml has no <Identity> element')
  return {
    name: readAttribute(tag, 'Name'),
    publisher: readAttribute(tag, 'Publisher'),
    version: readAttribute(tag, 'Version')
  }
}

/** The Properties/PublisherDisplayName value; must equal the Partner Center
 *  account's publisher display name or certification rejects the package. */
export function parseManifestPublisherDisplayName(xml) {
  const match = /<PublisherDisplayName\b[^>]*>([^<]*)<\/PublisherDisplayName>/i.exec(xml ?? '')
  return match ? match[1].trim() : undefined
}

/** Reasons the packaged manifest disagrees with the submission inputs. */
export function manifestProblems(xml, { identityName, publisher, version, publisherDisplayName }) {
  const identity = parseManifestIdentity(xml)
  const expected = toWindowsVersion(version)
  const problems = []
  if (identity.name !== (identityName ?? '').trim()) {
    problems.push(`manifest identity name "${identity.name}" does not match "${identityName}"`)
  }
  if (identity.publisher !== (publisher ?? '').trim()) {
    problems.push(`manifest publisher "${identity.publisher}" does not match "${publisher}"`)
  }
  if (identity.version !== expected) {
    problems.push(`manifest version "${identity.version}" does not match "${expected}"`)
  }
  const displayName = parseManifestPublisherDisplayName(xml)
  if (displayName !== (publisherDisplayName ?? '').trim()) {
    problems.push(
      `manifest publisher display name "${displayName}" does not match "${publisherDisplayName}"`
    )
  }
  return problems
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
  process.stderr.write(`store-submission: ${message}\n`)
  process.exit(1)
}

function runValidate(args) {
  if (isPlaceholderIdentity(args['identity-name'], args.publisher)) {
    fail(identityProblems(args['identity-name'], args.publisher).join('; '))
  }
  if ((args['display-name'] ?? '').trim() === '') {
    fail('the publisher display name is not set')
  }
  const expected = toWindowsVersion(args.version)
  if (!isVersionGreaterThan(args.version, args.published)) {
    fail(`version ${expected} is not greater than the published version ${args.published}`)
  }
  process.stdout.write(`store-submission: inputs valid for version ${expected}\n`)
}

function runValidateManifest(args) {
  const xml = fs.readFileSync(args.manifest, 'utf-8')
  const problems = manifestProblems(xml, {
    identityName: args['identity-name'],
    publisher: args.publisher,
    version: args.version,
    publisherDisplayName: args['display-name']
  })
  if (problems.length > 0) fail(problems.join('; '))
  process.stdout.write(
    `store-submission: manifest identity matches version ${toWindowsVersion(args.version)}\n`
  )
}

function runAssertTag(args) {
  const tag = (args.ref ?? '').replace(/^v/, '').trim()
  if (tag !== args.version.trim()) {
    fail(`version ${args.version} does not match the release tag ${args.ref}`)
  }
  process.stdout.write(`store-submission: version matches tag ${args.ref}\n`)
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
    if (command === 'validate') runValidate(args)
    else if (command === 'validate-manifest') runValidateManifest(args)
    else if (command === 'assert-tag') runAssertTag(args)
    else fail(`unknown command "${command}"`)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}
