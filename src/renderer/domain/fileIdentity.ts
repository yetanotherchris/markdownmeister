export interface FileIdentity {
  path: string | null
  canonicalPath?: string
}

/**
 * Compare two documents by file identity. When both sides have a non-empty
 * `canonicalPath`, exact equality of those values decides, so different
 * identities are different files even when the paths match. The path
 * comparison is only a fallback for documents without an identity, and a null
 * path matches nothing.
 */
export function sameFile(a: FileIdentity, b: FileIdentity): boolean {
  if (a.canonicalPath && b.canonicalPath) return a.canonicalPath === b.canonicalPath
  if (a.path === null || b.path === null) return false
  return a.path === b.path
}
