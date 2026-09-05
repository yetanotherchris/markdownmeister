import * as fs from 'fs'
import * as path from 'path'
import { isMarkdown } from './read'
import type { SearchContentResult } from '../../shared/ipc-contract'

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
 * (case-insensitive substring). Returns one `SearchContentResult` per matching
 * file: the workspace-relative posix path in the tree's id style, the number
 * of occurrences of the term, and the distinct lines (full text, in file
 * order) that contain at least one occurrence. The walk is asynchronous so a
 * large workspace never blocks the main process, only descends into real
 * directories, and only reads regular markdown files, so symlinks (which could
 * point outside the root) are never followed. Files that are too large or fail
 * to read are skipped silently. An empty or whitespace-only term matches
 * nothing. The walk never throws: unreadable directories are skipped.
 */
export async function searchContents(root: string, term: string): Promise<SearchContentResult[]> {
  const needle = term.trim().toLowerCase()
  if (needle === '') return []
  const results: SearchContentResult[] = []

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
        const matches = await fileMatchesCached(filePath, needle)
        if (matches) {
          results.push({ path: path.posix.join(relPrefix, entry.name), ...matches })
        }
      }
    }
  }

  await walk(root, '.')
  // Directory read order is filesystem-dependent; sort like the tree does so
  // results are deterministic across platforms.
  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}

async function fileMatchesCached(
  filePath: string,
  needle: string
): Promise<{ count: number; lines: string[] } | null> {
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
  } catch {
    return null
  }
  if (stat.size > MAX_SEARCH_FILE_BYTES) return null
  const cached = contentCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return matchLines(cached.content, needle)
  }
  let content: string
  try {
    content = await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
  // The stat cap was a pre-read guard; a file that grew past the cap mid-read
  // is still skipped rather than cached.
  if (content.length > MAX_SEARCH_FILE_BYTES) return null
  if (cachedBytes > MAX_CACHE_TOTAL_BYTES) {
    contentCache.clear()
    cachedBytes = 0
  }
  if (cached) cachedBytes -= cached.content.length
  contentCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, content })
  cachedBytes += content.length
  return matchLines(content, needle)
}

/** Count every case-insensitive occurrence and collect the distinct lines that
 *  contain one; a line with several occurrences counts each but appears once. */
function matchLines(content: string, needle: string): { count: number; lines: string[] } | null {
  const lines: string[] = []
  let count = 0
  for (const line of content.split('\n')) {
    const lower = line.toLowerCase()
    let from = lower.indexOf(needle)
    if (from === -1) continue
    lines.push(line)
    while (from !== -1) {
      count++
      from = lower.indexOf(needle, from + needle.length)
    }
  }
  return count > 0 ? { count, lines } : null
}
