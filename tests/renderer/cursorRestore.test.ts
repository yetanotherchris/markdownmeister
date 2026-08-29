import { describe, it, expect, vi } from 'vitest'
import { Schema } from '@milkdown/kit/prose/model'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import {
  planCursorRestore,
  planBlockRestore,
  applyCursorRestore,
  revealCaretInView
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

/** The visual document Milkdown keeps after a non-paragraph last block: a
 *  trailing empty paragraph (nodeSize 2) that the parsed text has no block
 *  for, so its child count is the block count plus one. */
function buildDocWithTrailingEmpty(): PMNode {
  const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
  return schema.node('doc', null, [
    para('ab'),
    schema.node('blockquote', null, [para('quote')]),
    para('cd'),
    para('')
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

  it('accepts a trailing empty paragraph beyond the correlated block count', () => {
    const doc = buildDocWithTrailingEmpty()
    for (const blockIndex of [0, 1, 2]) {
      const selection = planBlockRestore(doc, blockIndex, 3)
      expect(selection).not.toBeNull()
      const $pos = doc.resolve(selection!.head)
      expect($pos.parent.inlineContent).toBe(true)
    }
    // The last real block still resolves inside its own block, not the
    // artifact paragraph appended after it.
    expect(planBlockRestore(doc, 2, 3)!.head).toBeGreaterThanOrEqual(13)
    expect(planBlockRestore(doc, 2, 3)!.head).toBeLessThan(17)
  })

  it('refuses the leniency when the extra trailing child is not an empty paragraph', () => {
    const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
    const doc = schema.node('doc', null, [
      para('ab'),
      schema.node('blockquote', null, [para('quote')]),
      para('cd'),
      para('not empty')
    ])
    expect(planBlockRestore(doc, 0, 3)).toBeNull()
    expect(planBlockRestore(doc, 2, 3)).toBeNull()
  })

  it('descends into a container as the last real block ahead of the artifact', () => {
    const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
    const doc = schema.node('doc', null, [
      para('ab'),
      para('cd'),
      schema.node('blockquote', null, [para('quote end')]),
      para('')
    ])
    const selection = planBlockRestore(doc, 2, 3)
    expect(selection).not.toBeNull()
    const $pos = doc.resolve(selection!.head)
    expect($pos.parent.inlineContent).toBe(true)
    // The caret descends into the quote's paragraph (spans 8-21) and never
    // lands in the artifact paragraph that follows it.
    expect(selection!.head).toBeGreaterThanOrEqual(8)
    expect(selection!.head).toBeLessThan(21)
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

describe('revealCaretInView (spec 052)', () => {
  function fakeView(coords: { top: number; bottom: number }): EditorView {
    return {
      coordsAtPos: () => coords
    } as unknown as EditorView
  }

  function scrollElementWith(rect: { top: number; bottom: number }): HTMLElement {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientHeight', { value: rect.bottom - rect.top })
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: rect.top,
      bottom: rect.bottom,
      left: 0,
      right: 0,
      width: 100,
      height: rect.bottom - rect.top,
      x: 0,
      y: rect.top,
      toJSON: () => ({})
    } as DOMRect)
    return el
  }

  it('centers an off-screen caret in the scrollable host', () => {
    const el = scrollElementWith({ top: 100, bottom: 600 })
    revealCaretInView(fakeView({ top: 2000, bottom: 2020 }), 5, el)
    // 2000 - 100 - (500 / 2) = 1650
    expect(el.scrollTop).toBe(1650)
  })

  it('leaves the scroll alone when the caret is already in view', () => {
    const el = scrollElementWith({ top: 100, bottom: 600 })
    revealCaretInView(fakeView({ top: 200, bottom: 220 }), 5, el)
    expect(el.scrollTop).toBe(0)
  })

  it('does nothing without a scroll element or coordinates', () => {
    expect(() => revealCaretInView(fakeView({ top: 2000, bottom: 2020 }), 5, null)).not.toThrow()
    const el = scrollElementWith({ top: 100, bottom: 600 })
    const blind = { coordsAtPos: () => null } as unknown as EditorView
    expect(() => revealCaretInView(blind, 5, el)).not.toThrow()
    expect(el.scrollTop).toBe(0)
  })
})
