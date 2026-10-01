export const PLACEHOLDER_IDENTITY_NAME: string
export const PLACEHOLDER_PUBLISHER: string

export function identityProblems(identityName: string, publisher: string): string[]
export function isPlaceholderIdentity(identityName: string, publisher: string): boolean
export function assertRealIdentity(identityName: string, publisher: string): void

export function toWindowsVersion(version: string): string
export function compareWindowsVersions(a: string, b: string): -1 | 0 | 1
export function isVersionGreaterThan(version: string, publishedVersion: string): boolean

export interface ManifestIdentity {
  name: string | undefined
  publisher: string | undefined
  version: string | undefined
}

export function parseManifestIdentity(xml: string): ManifestIdentity

export interface SubmissionIdentity {
  identityName: string
  publisher: string
  version: string
}

export function manifestProblems(xml: string, identity: SubmissionIdentity): string[]
