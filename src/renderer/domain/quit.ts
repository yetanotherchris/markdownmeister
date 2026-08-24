import type { DocumentState } from '../state/documents'


export function dirtyDocumentsToSave(
  documents: DocumentState[],
  isDirty: (doc: DocumentState) => boolean
): DocumentState[] {
  return documents.filter((d) => isDirty(d))
}


export function shouldRePromptForFailedSave(saved: 'saved' | 'cancelled' | 'failed'): boolean {
  return saved !== 'saved'
}
