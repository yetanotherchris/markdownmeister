import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { findMisspellings } from '../domain/spellcheck'
import { spellcheckRuntime, updateSpellcheckRuntime, onSpellcheckRuntimeChange } from './spellcheckRuntime'



export interface SpellingMenuState {
  x: number
  y: number
  word: string
  suggestions: string[]
  /** Replace the misspelled word with `replacement`. */
  apply: (replacement: string) => void
  /** Teach the word to the user dictionary and persist it. */
  addToDictionary: () => void
}

interface SpellcheckPluginState {
  decos: DecorationSet
}

export const spellcheckKey = new PluginKey<SpellcheckPluginState>('mm-spellcheck')

const RECOMPUTE_DEBOUNCE_MS = 120
const MAX_SUGGESTIONS = 5

const INITIAL_PASS_IDLE_TIMEOUT_MS = 2_000


function isSkippedNode(node: PMNode): boolean {
  const name = node.type.name
  return name === 'code_block' || name === 'fence' || name === 'math'
}


const INLINE_CODE_MARKS = new Set(['inlineCode', 'n'])

function isInlineCodeText(node: PMNode): boolean {
  return node.isText && node.marks.some((mark) => INLINE_CODE_MARKS.has(mark.type.name))
}

/** Every spellcheckable text segment with its absolute doc offsets. */
function collectTextSegments(doc: PMNode): Array<{ from: number; to: number; text: string }> {
  const segments: Array<{ from: number; to: number; text: string }> = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      if (!isInlineCodeText(node)) {
        segments.push({ from: pos, to: pos + node.nodeSize, text: node.text ?? '' })
      }
      return false
    }
    return !isSkippedNode(node)
  })
  return segments
}

/** Build the decoration set for the whole document. */
export function computeSpellcheckDecorations(view: EditorView): DecorationSet {
  const runtime = spellcheckRuntime
  if (!runtime.enabled) return DecorationSet.empty

  const decorations: Decoration[] = []
  for (const segment of collectTextSegments(view.state.doc)) {
    for (const misspelling of findMisspellings(segment.text, runtime.checker, runtime.customWords)) {
      decorations.push(
        Decoration.inline(segment.from + misspelling.start, segment.from + misspelling.end, {
          class: 'mm-spelling-error'
        })
      )
    }
  }
  return DecorationSet.create(view.state.doc, decorations)
}

/** Dispatch a fresh decoration set onto the view (no doc change). */
function applyDecorations(view: EditorView): void {
  const decos = computeSpellcheckDecorations(view)
  view.dispatch(view.state.tr.setMeta(spellcheckKey, { decos }))
}

/**
 * Create the plugin. `onMenu` is invoked with a correction menu (or `null` to
 * dismiss); it is the plugin's only way out of the editor, so callers should
 * pass a stable wrapper that reads the latest prop from a ref.
 */
export function spellcheckPlugin(onMenu: (menu: SpellingMenuState | null) => void): Plugin {
  return new Plugin<SpellcheckPluginState>({
    key: spellcheckKey,

    state: {
      init() {
        return { decos: DecorationSet.empty }
      },
      apply(tr, value) {
        const meta = tr.getMeta(spellcheckKey)
        return meta ? { decos: meta.decos } : value
      }
    },

    props: {
      decorations(state) {
        return spellcheckKey.getState(state)?.decos ?? DecorationSet.empty
      },

      handleDOMEvents: {
        contextmenu(view, event) {
          return handleContextMenu(view, event, onMenu)
        }
      }
    },

    view(view) {
      let timer: ReturnType<typeof setTimeout> | null = null
      let idleId: number | null = null
      let destroyed = false
      let lastVersion = spellcheckRuntime.version

      const schedule = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          if (!destroyed) applyDecorations(view)
        }, RECOMPUTE_DEBOUNCE_MS)
      }

      const hasIdleApi = typeof window.requestIdleCallback === 'function'
      const runInitialPass = () => {
        idleId = null
        if (!destroyed) schedule()
      }
      idleId = hasIdleApi
        ? window.requestIdleCallback(runInitialPass, { timeout: INITIAL_PASS_IDLE_TIMEOUT_MS })
        : window.setTimeout(runInitialPass, 0)

      // Re-check immediately when settings/custom-words change (no doc change).
      const unsubscribeRuntime = onSpellcheckRuntimeChange(schedule)

      return {
        update(view, prevState) {
          if (view.state.doc !== prevState.doc || spellcheckRuntime.version !== lastVersion) {
            lastVersion = spellcheckRuntime.version
            schedule()
          }
        },
        destroy() {
          destroyed = true
          if (idleId !== null) {
            if (hasIdleApi) window.cancelIdleCallback(idleId)
            else window.clearTimeout(idleId)
          }
          unsubscribeRuntime()
          if (timer) clearTimeout(timer)
        }
      }
    }
  })
}

/** Open the correction menu when the right-click lands on a marked word. */
function handleContextMenu(
  view: EditorView,
  event: MouseEvent,
  onMenu: (menu: SpellingMenuState | null) => void
): boolean {
  const runtime = spellcheckRuntime
  if (!runtime.enabled) return false

  const target = event.target as HTMLElement | null
  if (!target || !(target instanceof Element)) return false
  const span = target.closest('.mm-spelling-error') as HTMLElement | null
  if (!span) {
    // Not on a misspelled word: dismiss any open menu, let the default pass.
    onMenu(null)
    return false
  }

  // The decorated span wraps exactly the misspelled word (inline decoration),
  // so its DOM offsets map straight to the doc range.
  const from = view.posAtDOM(span, 0)
  const to = view.posAtDOM(span, span.childNodes.length)
  if (from < 0 || to <= from) return false

  const word = view.state.doc.textBetween(from, to)
  if (!word) return false

  const suggestions = runtime.checker.suggest(word).slice(0, MAX_SUGGESTIONS)

  event.preventDefault()
  onMenu({
    x: event.clientX,
    y: event.clientY,
    word,
    suggestions,
    apply: (replacement) => {
      view.dispatch(view.state.tr.insertText(replacement, from, to).scrollIntoView())
      view.focus()
      onMenu(null)
    },
    addToDictionary: () => {
      const wordKey = word.toLowerCase()
      if (!spellcheckRuntime.customWords.has(wordKey)) {
        spellcheckRuntime.customWords.add(wordKey)
        // Notify every editor + re-check now; persist in main (the local set
        // is authoritative for this session).
        updateSpellcheckRuntime({ customWords: spellcheckRuntime.customWords })
        window.api.addSpellcheckWord(wordKey).catch(() => {  })
      }
      applyDecorations(view)
      onMenu(null)
    }
  })
  return true
}
