import type { DocumentState } from '../state/documents'
import { markdownSame } from '../state/documents'
import { joinFrontmatter } from './frontmatter'
import { recordOutgoingSerialization } from '../editor/openPerformance'


export type MarkdownAccessor = (documentId: string) => string | null


export type DocRefAccessor = (documentId: string) => unknown

/** The editor's live serialization for a document, or null when it has no
 *  mounted editor (evicted). A source-view document's text lives in the store,
 *  not the editor, so this returns null there too. */
export function getLiveContent(doc: DocumentState, getMarkdown: MarkdownAccessor): string | null {
  if (doc.editorState !== 'live') return null
  return getMarkdown(doc.id)
}


export function isDirtyLive(
  doc: DocumentState,
  getMarkdown: MarkdownAccessor,
  getLiveDoc?: DocRefAccessor,
  getBaselineDoc?: DocRefAccessor
): boolean {
  if (doc.dirty) return true
  if (doc.view === 'source') return false
  if (getLiveDoc && getBaselineDoc) {
    const live = getLiveDoc(doc.id)
    if (live !== undefined && live === getBaselineDoc(doc.id)) return false
  }
  const live = getLiveContent(doc, getMarkdown)
  if (live === null) return false
  recordOutgoingSerialization()
  return !markdownSame(live, doc.editorBaseline)
}


export function getContentToSave(doc: DocumentState, getMarkdown: MarkdownAccessor): string {
  if (doc.view === 'source') return joinFrontmatter(doc.frontmatter, doc.content)
  if (isDirtyLive(doc, getMarkdown)) {
    const live = getMarkdown(doc.id)
    if (live === null || markdownSame(live, doc.content)) {
      return joinFrontmatter(doc.frontmatter, doc.content)
    }
    return joinFrontmatter(doc.frontmatter, live)
  }
  return joinFrontmatter(doc.frontmatter, doc.content)
}


export function shouldFlushLive(doc: DocumentState, getMarkdown: MarkdownAccessor): boolean {
  if (doc.view === 'source') return false
  const live = getLiveContent(doc, getMarkdown)
  if (live === null || markdownSame(live, doc.content)) return false
  if (!doc.dirty) return false
  return true
}
