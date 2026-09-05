import type { SearchContentResult } from '../../shared/ipc-contract'
import type { TreeNode } from '../state/workspace'
import { parentPathOf } from '../state/workspace'

/** One section in the results view: a file with its display info, the number
 *  of matches (name matches count 1, content matches count occurrences), and
 *  the snippet lines (content matches only). */
export interface SearchSection {
  path: string
  name: string
  /** Directory path portion (may be '' for a root-level file). */
  directory: string
  count: number
  lines: string[]
}

/** All markdown files in the loaded tree data whose name contains the term
 *  (case-insensitive). A name match has no content lines. */
export function nameMatchSections(nodes: TreeNode[], term: string): SearchSection[] {
  const trimmed = term.trim()
  if (trimmed === '') return []
  const sections: SearchSection[] = []
  const walk = (children: TreeNode[]): void => {
    for (const node of children) {
      if (node.kind === 'file' && node.name.toLowerCase().includes(trimmed.toLowerCase())) {
        sections.push({
          path: node.id,
          name: node.name,
          directory: parentPathOf(node.id),
          count: 1,
          lines: []
        })
      }
      if (node.kind === 'directory' && node.children) walk(node.children)
    }
  }
  walk(nodes)
  return sections
}

/** Merge name matches (from the loaded tree) and content matches (from the
 *  workspace-wide scan). A path in both appears once with the content count.
 *  Sorted by directory then name for a stable report. */
export function mergeSearchSections(
  nameSections: SearchSection[],
  contentResults: SearchContentResult[]
): SearchSection[] {
  const byPath = new Map<string, SearchSection>()
  for (const s of nameSections) byPath.set(s.path, s)
  for (const r of contentResults) {
    // A name match is kept as-is unless the file also has content matches, in
    // which case the content count and lines win (a file matching both shows
    // its content matches once).
    byPath.set(r.path, {
      path: r.path,
      name: r.path.split('/').pop() ?? r.path,
      directory: parentPathOf(r.path),
      count: r.count,
      lines: r.lines
    })
  }
  return [...byPath.values()].sort((a, b) => {
    const dirCmp = a.directory.localeCompare(b.directory)
    return dirCmp !== 0 ? dirCmp : a.name.localeCompare(b.name)
  })
}

/** The "N matches in M files" summary line (FR-002): total instances across
 *  all sections (name matches count 1, content matches count occurrences). */
export function summarize(sections: SearchSection[]): { matches: number; files: number } {
  const matches = sections.reduce((sum, s) => sum + s.count, 0)
  return { matches, files: sections.length }
}

/**
 * Truncate a snippet line to at most `maxChars`, keeping a window around the
 * first occurrence of `term` (case-insensitive) visible and appending `...`
 * on each truncated side. Never hides the term: the window always spans the
 * whole match, growing past `maxChars` when the term itself is longer. A line
 * short enough to fit is returned unchanged.
 */
export function truncateSnippet(line: string, term: string, maxChars: number): string {
  const trimmed = term.trim()
  if (line.length <= maxChars || trimmed === '') return line
  const lower = line.toLowerCase()
  const idx = lower.indexOf(trimmed.toLowerCase())
  const ellipsis = '...'
  // The window must fit the whole match; with a short term it is capped so the
  // output (window + ellipses) stays within maxChars.
  const span = Math.max(maxChars - ellipsis.length * 2, trimmed.length)
  const start = Math.max(0, Math.min(idx, line.length - span))
  const end = Math.min(line.length, start + span)
  const prefix = start > 0 ? ellipsis : ''
  const suffix = end < line.length ? ellipsis : ''
  return prefix + line.slice(start, end) + suffix
}

/** Split `text` into { text, match } segments so the caller can highlight
 *  every case-insensitive occurrence of `term`. The term is escaped so it is
 *  never treated as a pattern. */
export function highlightSegments(
  text: string,
  term: string
): Array<{ text: string; match: boolean }> {
  const trimmed = term.trim()
  if (trimmed === '') return [{ text, match: false }]
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  const segments: Array<{ text: string; match: boolean }> = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), match: false })
    segments.push({ text: m[0], match: true })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false })
  return segments
}
