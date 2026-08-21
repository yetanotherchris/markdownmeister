import type { DocumentState } from '../state/documents'
import type { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'

const MAX_INSTANCES = 8

interface InstanceEntry {
  documentId: string
  editor: Crepe
  lastActiveAt: number
  /** Spec 033 (contract C2): the ProseMirror document object reference at the
   *  moment `editorBaseline` was captured. Reference identity with the live
   *  view's doc proves no doc-changing transaction occurred, so dirty checks
   *  can return clean without serializing. Cleared when the entry is removed,
   *  and explicitly when a save moves `editorBaseline` without a remount. */
  baselineDoc: unknown | null
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

  /** Record the document reference captured alongside `editorBaseline`
   *  (spec 033). No-op when no live entry exists for the document. */
  setBaselineDoc(documentId: string, docRef: unknown): void {
    const entry = this.instances.get(documentId)
    if (entry) entry.baselineDoc = docRef
  }

  getBaselineDoc(documentId: string): unknown | null {
    return this.instances.get(documentId)?.baselineDoc ?? null
  }

  /** Drop the recorded identity: the fast path must never prove cleanliness
   *  against a baseline that has moved (e.g. after SAVE_SUCCESS rewrites
   *  `editorBaseline` without a remount). */
  clearBaselineDoc(documentId: string): void {
    const entry = this.instances.get(documentId)
    if (entry) entry.baselineDoc = null
  }

  /** The registered editor's current ProseMirror document reference, or null
   *  when no live entry exists. Reading identity does not serialize. */
  getLiveDoc(documentId: string): unknown | null {
    const entry = this.instances.get(documentId)
    if (!entry) return null
    try {
      const view = entry.editor.editor.action((ctx) => ctx.get(editorViewCtx))
      return view.state.doc
    } catch {
      // A torn-down or not-yet-created view has no identity to compare.
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

  /** Run `fn` for every live editor (spec 030 reconfiguration fan-out). */
  forEach(fn: (editor: Crepe) => void): void {
    this.instances.forEach((entry) => fn(entry.editor))
  }

  /**
   * Returns the id of the oldest *clean* live instance to evict, or null when
   * nothing may be evicted (every live instance is dirty, or the only clean
   * one is the active document). The active document is never evicted — its
   * editor would vanish while visible. Does not remove the entry; the caller
   * does that after capturing any state it needs.
   */
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
