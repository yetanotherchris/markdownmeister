// React 19 requires IS_REACT_ACT_ENVIRONMENT for act() to flush updates in
// tests (used by tests/renderer/quit.test.tsx).
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom implements no layout, and its Range lacks the client-rect methods that
// CodeMirror's scroll-into-view measurement calls. An empty rect list makes
// the measurement resolve to "nothing to scroll", which matches a zero-size
// layout, so editor interactions stay testable.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  const zeroRect = (): DOMRect =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect
  const emptyRectList = (): DOMRectList =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getClientRects = emptyRectList
  Range.prototype.getBoundingClientRect = zeroRect
}
