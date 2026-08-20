import { describe, it, expect } from 'vitest'
import type { Crepe } from '@milkdown/crepe'
import { InstancePool } from '../../src/renderer/editor/instancePool'

/** A stub shaped like the pieces of Crepe the pool touches: `getMarkdown`
 *  and `editor.action(ctx => ctx.get(editorViewCtx))`. */
function stubEditor(docRef: object | null): Crepe {
  return {
    getMarkdown: () => '# stub\n',
    editor: {
      action: (fn: (ctx: unknown) => unknown) =>
        fn({
          get: () => ({ state: { doc: docRef } })
        })
    }
  } as unknown as Crepe
}

describe('InstancePool baseline-doc identity (spec 033, contract C2)', () => {
  it('records and returns the identity for a registered document', () => {
    const pool = new InstancePool()
    const docRef = { marker: 'a' }
    pool.register('doc-1', stubEditor(docRef))
    pool.setBaselineDoc('doc-1', docRef)
    expect(pool.getBaselineDoc('doc-1')).toBe(docRef)
  })

  it('setBaselineDoc is a no-op for an unregistered document', () => {
    const pool = new InstancePool()
    expect(() => pool.setBaselineDoc('missing', { marker: 1 })).not.toThrow()
    expect(pool.getBaselineDoc('missing')).toBeNull()
  })

  it('a fresh entry has no recorded identity', () => {
    const pool = new InstancePool()
    pool.register('doc-1', stubEditor({ marker: 'a' }))
    expect(pool.getBaselineDoc('doc-1')).toBeNull()
  })

  it('clearBaselineDoc drops the identity but keeps the entry', () => {
    const pool = new InstancePool()
    const docRef = { marker: 'a' }
    pool.register('doc-1', stubEditor(docRef))
    pool.setBaselineDoc('doc-1', docRef)
    pool.clearBaselineDoc('doc-1')
    expect(pool.getBaselineDoc('doc-1')).toBeNull()
    expect(pool.getLiveDoc('doc-1')).toBe(docRef)
  })

  it('remove drops the entry together with its identity', () => {
    const pool = new InstancePool()
    const docRef = { marker: 'a' }
    pool.register('doc-1', stubEditor(docRef))
    pool.setBaselineDoc('doc-1', docRef)
    pool.remove('doc-1')
    expect(pool.getBaselineDoc('doc-1')).toBeNull()
    expect(pool.getLiveDoc('doc-1')).toBeNull()
  })

  it('getLiveDoc reads the current document reference through the editor', () => {
    const pool = new InstancePool()
    const atRegister = { version: 1 }
    pool.register('doc-1', stubEditor(atRegister))
    expect(pool.getLiveDoc('doc-1')).toBe(atRegister)
  })

  it('getLiveDoc returns null when the editor action throws (torn-down view)', () => {
    const pool = new InstancePool()
    const broken = {
      editor: {
        action: () => {
          throw new Error('destroyed')
        }
      }
    } as unknown as Crepe
    pool.register('doc-1', broken)
    expect(pool.getLiveDoc('doc-1')).toBeNull()
  })
})
