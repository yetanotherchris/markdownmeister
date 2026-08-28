import { describe, it, expect } from 'vitest'
import { Schema } from '@milkdown/kit/prose/model'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import {
  planCursorRestore,
  planBlockRestore,
  applyCursorRestore
} from '../../src/renderer/editor/cursorRestore'

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

describe('planBlockRestore (spec 052)', () => {
  it('resolves each top-level block to a valid inline selection', () => {
    const doc = buildDoc()
    for (const blockIndex of [0, 1, 2]) {
      const selection = planBlockRestore(doc, blockIndex, 3)
      expect(selection).not.toBeNull()
      const $pos = doc.resolve(selection!.head)
      expect($pos.parent.inlineContent).toBe(true)
      // Each resolution lands inside its own block, not a neighbour.
      const blockStart = [0, 4, 13][blockIndex]
      expect(selection!.head).toBeGreaterThanOrEqual(blockStart)
      expect(selection!.head).toBeLessThan(blockStart + [4, 9, 4][blockIndex])
    }
  })

  it('places block 0 at the first text position of the document', () => {
    const doc = buildDoc()
    expect(planBlockRestore(doc, 0, 3)!.head).toBe(1)
  })

  it('rejects a count mismatch, out-of-range index, or empty document', () => {
    const doc = buildDoc()
    expect(planBlockRestore(doc, 0, 2)).toBeNull()
    expect(planBlockRestore(doc, 3, 3)).toBeNull()
    expect(planBlockRestore(doc, -1, 3)).toBeNull()
    expect(planBlockRestore(doc, 0, 0)).toBeNull()
    const empty = schema.topNodeType.create([])
    expect(planBlockRestore(empty, 0, 1)).toBeNull()
  })
})

describe('applyCursorRestore', () => {
  interface FakeTr {
    selection?: Selection
    scrolledIntoView?: boolean
  }

  /** Minimal view double: every `state.tr` access yields a fresh chainable
   *  transaction recorder; dispatch collects them in order. */
  function fakeView(doc: PMNode): {
    view: EditorView
    dispatched: FakeTr[]
    scrollElement: HTMLElement
  } {
    const dispatched: FakeTr[] = []
    const view = {
      state: {
        doc,
        get tr() {
          const recorded: FakeTr = {}
          const chain = recorded as FakeTr & {
            setSelection: (selection: Selection) => typeof chain
            scrollIntoView: () => typeof chain
          }
          chain.setSelection = (selection) => {
            recorded.selection = selection
            return chain
          }
          chain.scrollIntoView = () => {
            recorded.scrolledIntoView = true
            return chain
          }
          return chain
        }
      },
      dispatch(tr: FakeTr) {
        dispatched.push(tr)
      }
    } as unknown as EditorView
    return { view, dispatched, scrollElement: document.createElement('div') }
  }

  it('reveals the caret when the stored offset cannot host a selection', () => {
    const doc = buildDoc()
    const { view, dispatched, scrollElement } = fakeView(doc)
    scrollElement.scrollTop = 40

    applyCursorRestore(view, { cursorOffset: 5, scrollTop: 140 }, scrollElement)

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].selection).toBeDefined()
    expect(doc.resolve(dispatched[0].selection!.head).parent.inlineContent).toBe(true)
    // The reveal intent is the scrollIntoView flag on the dispatched
    // transaction; the stale scroll value is skipped on this path.
    expect(dispatched[0].scrolledIntoView).toBe(true)
    expect(scrollElement.scrollTop).toBe(40)
  })

  it('reveals instead of scrolling when the offset is clamped past the document end', () => {
    const doc = buildDoc()
    const { view, dispatched, scrollElement } = fakeView(doc)

    applyCursorRestore(view, { cursorOffset: doc.content.size + 100, scrollTop: 90 }, scrollElement)

    expect(dispatched[0].scrolledIntoView).toBe(true)
    expect(scrollElement.scrollTop).toBe(0)
  })

  it('applies an exact offset plainly and reapplies the recorded scroll', () => {
    const doc = buildDoc()
    const { view, dispatched, scrollElement } = fakeView(doc)

    applyCursorRestore(view, { cursorOffset: 2, scrollTop: 120 }, scrollElement)

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].scrolledIntoView).toBeUndefined()
    expect(dispatched[0].selection!.head).toBe(2)
    expect(scrollElement.scrollTop).toBe(120)
  })
})
