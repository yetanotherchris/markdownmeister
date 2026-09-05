import * as fs from 'fs'
import * as path from 'path'
import { isMarkdown } from './read'

/** Files larger than this are skipped by content search (FR-012). The cap
 *  comfortably covers the app's large-document floor (~10k lines ≈ 300 KB)
 *  while keeping a single workspace-wide scan bounded. */
const MAX_SEARCH_FILE_BYTES = 1_000_000

/** Upper bound on the total cached content bytes; when exceeded the cache is
 *  cleared and rebuilt lazily (one cold re-scan per workspace session). */
const MAX_CACHE_TOTAL_BYTES = 64 * 1024 * 1024

interface CachedContent {
  mtimeMs: number
  size: number
  content: string
}

// File contents keyed by absolute path and validated against mtime+size, so a
// repeated search over a stable workspace re-reads no files (only stat calls).
// Paths are absolute and workspace-specific, so different workspaces never
// collide; the total byte count keeps the cache bounded.
const contentCache = new Map<string, CachedContent>()
let cachedBytes = 0

/**
 * Recursively find markdown files under `root` whose contents contain `term`
 * (case-insensitive substring). Returns workspace-relative posix paths in the
 * same style the tree uses ('file.md', 'docs/sub/file.md'). The walk is
 * asynchronous so a large workspace never blocks the main process, only
 * descends into real directories, and only reads regular markdown files, so
 * symlinks (which could point outside the root) are never followed. Files that
 * are too large or fail to read are skipped silently. An empty or
 * whitespace-only term matches nothing. The walk never throws: unreadable
 * directories are skipped.
 */
export async function searchContents(root: string, term: string): Promise<string[]> {
  const needle = term.trim().toLowerCase()
  if (needle === '') return []
  const matches: string[] = []

  const walk = async (dir: string, relPrefix: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), path.posix.join(relPrefix, entry.name))
      } else if (entry.isFile() && isMarkdown(entry.name)) {
        const filePath = path.join(dir, entry.name)
        if (await fileContainsCached(filePath, needle)) {
          matches.push(path.posix.join(relPrefix, entry.name))
        }
      }
    }
  }

  await walk(root, '.')
  // Directory read order is filesystem-dependent; sort like the tree does so
  // results are deterministic across platforms.
  matches.sort((a, b) => a.localeCompare(b))
  return matches
}

async function fileContainsCached(filePath: string, needle: string): Promise<boolean> {
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
  } catch {
    return false
  }
  if (stat.size > MAX_SEARCH_FILE_BYTES) return false
  const cached = contentCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.content.toLowerCase().includes(needle)
  }
  let content: string
  try {
    content = await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return false
  }
  // The stat cap was a pre-read guard; a file that grew past the cap mid-read
  // is still skipped rather than cached.
  if (content.length > MAX_SEARCH_FILE_BYTES) return false
  if (cachedBytes > MAX_CACHE_TOTAL_BYTES) {
    contentCache.clear()
    cachedBytes = 0
  }
  if (cached) cachedBytes -= cached.content.length
  contentCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, content })
  cachedBytes += content.length
  return content.toLowerCase().includes(needle)
}
