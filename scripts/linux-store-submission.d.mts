export const SNAP_NAME: string

export function isSemver(version: string): boolean
export function assertSemver(version: string): void

export function normaliseTag(ref: string): string
export function assertVersionMatchesTag(version: string, ref: string): void

export function containsVersionToken(file: string, version: string): boolean
export function isSnapArtifactName(name: string, version: string): boolean
export function assertSnapArtifactName(name: string, version: string): void

export function hasSnapCredentials(env: { SNAPCRAFT_STORE_CREDENTIALS?: string }): boolean
