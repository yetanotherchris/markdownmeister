export interface ArtifactNames {
  dmg: string
  zip: string
}

export interface VerificationOptions {
  artifactsDir: string
  version: string
  arch: string
  identity: string
}

export function artifactNames(version: string, arch: string): ArtifactNames
export function validationCommands(appPath: string): [string, string[]][]
export function verifyArtifacts(options: VerificationOptions): void
