import type { DocumentState } from '../state/documents'
import type { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'

const MAX_INSTANCES = 8

interface InstanceEntry {
  documentId: string
  editor: Crepe
  lastActiveAt: number

  baselineDoc: unknown
}
export class InstancePool {
  private instances = new Map<string, InstanceEntry>()

  register(documentId: string, editor: Crepe): void {
    this.instances.set(documentId, {
      documentId,
      editor,
      lastActiveAt: Date.now(),
      baselineDoc: null
    })
  }

  remove(documentId: string): void {
    // The owning CrepeHost destroys the editor on unmount; this only drops the
    // bookkeeping entry (and with it the recorded baseline doc identity).
    // Destroying here would double-destroy the same editor.
    this.instances.delete(documentId)
  }


  setBaselineDoc(documentId: string, docRef: unknown): void {
    const entry = this.instances.get(documentId)
    if (entry) entry.baselineDoc = docRef
  }

  getBaselineDoc(documentId: string): unknown {
    return this.instances.get(documentId)?.baselineDoc
  }


  clearBaselineDoc(documentId: string): void {
    const entry = this.instances.get(documentId)
    if (entry) entry.baselineDoc = null
  }

  /** The registered editor's current ProseMirror document reference, or
   *  undefined when no live entry exists. Reading identity does not serialize. */
  getLiveDoc(documentId: string): unknown {
    const entry = this.instances.get(documentId)
    if (!entry) return undefined
    try {
      const view = entry.editor.editor.action((ctx) => ctx.get(editorViewCtx))
      return view.state.doc
    } catch {
      // A torn-down or not-yet-created view has no identity to compare.
      return undefined
    }
  }

  /** The live selection anchor and top-level child sizes the caret mapping
   *  correlates on, or null when no readable view exists. Reading structure
   *  does not serialize the document. */
  getSelectionGeometry(documentId: string): { caretOffset: number; childSizes: number[] } | null {
    const entry = this.instances.get(documentId)
    if (!entry) return null
    try {
      const view = entry.editor.editor.action((ctx) => ctx.get(editorViewCtx))
      const doc = view.state.doc
      const childSizes: number[] = []
      doc.forEach((child) => childSizes.push(child.nodeSize))
      return { caretOffset: view.state.selection.anchor, childSizes }
    } catch {
      return null
    }
  }

  getMarkdown(documentId: string): string | null {
    const entry = this.instances.get(documentId)
    if (!entry) return null
    // Reading the editor is a use: keep true LRU ordering for eviction.
    entry.lastActiveAt = Date.now()
    return entry.editor.getMarkdown()
  }


  forEach(fn: (editor: Crepe) => void): void {
    this.instances.forEach((entry) => fn(entry.editor))
  }


  evictLRU(dirtyDocuments: DocumentState[], activeId: string | null): string | null {
    const dirtyIds = new Set(dirtyDocuments.map(d => d.id))
    let oldest: InstanceEntry | null = null

    for (const entry of this.instances.values()) {
      if (entry.documentId === activeId) continue
      if (dirtyIds.has(entry.documentId)) continue
      if (!oldest || entry.lastActiveAt < oldest.lastActiveAt) {
        oldest = entry
      }
    }

    return oldest ? oldest.documentId : null
  }

  get liveCount(): number {
    return this.instances.size
  }

  hasSpace(): boolean {
    return this.instances.size < MAX_INSTANCES
  }

  destroyAll(): void {
    for (const entry of this.instances.values()) {
      entry.editor.destroy()
    }
    this.instances.clear()
  }
}

export const instancePool = new InstancePool()
