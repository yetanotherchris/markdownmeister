import { describe, it, expect } from 'vitest'
import { Schema } from '@milkdown/kit/prose/model'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { planCursorRestore } from '../../src/renderer/editor/cursorRestore'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
    blockquote: { group: 'block', content: 'block+' }
  }
})

function buildDoc(): PMNode {
  const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
  return schema.node('doc', null, [
    para('ab'),
    schema.node('blockquote', null, [para('quote')]),
    para('cd')
  ])
}

describe('planCursorRestore (spec 044 D3)', () => {
  it('returns no plan for a zero or negative stored offset', () => {
    const doc = buildDoc()
    expect(planCursorRestore(doc, 0)).toBeNull()
    expect(planCursorRestore(doc, -5)).toBeNull()
  })

  it('restores an offset inside plain text exactly and unclamped', () => {
    const doc = buildDoc()
    const plan = planCursorRestore(doc, 2)
    expect(plan).not.toBeNull()
    expect(plan!.clamped).toBe(false)
    expect(plan!.selection.head).toBe(2)
  })

  it('clamps an offset past the document end to the nearest valid position', () => {
    const doc = buildDoc()
    const size = doc.content.size
    const plan = planCursorRestore(doc, size + 100)
    expect(plan).not.toBeNull()
    expect(plan!.clamped).toBe(true)
    expect(plan!.selection.head).toBeLessThanOrEqual(size)
    expect(doc.resolve(plan!.selection.head).parent.inlineContent).toBe(true)
  })

  it('moves an offset that cannot host a text selection to the nearest valid position', () => {
    const doc = buildDoc()
    // Position 5 sits inside the blockquote but outside its paragraph, so its
    // parent has no inline content and a bare create there breaks the view.
    const plan = planCursorRestore(doc, 5)
    expect(plan).not.toBeNull()
    expect(plan!.clamped).toBe(true)
    const $pos = doc.resolve(plan!.selection.head)
    expect($pos.parent.inlineContent).toBe(true)
  })
})
