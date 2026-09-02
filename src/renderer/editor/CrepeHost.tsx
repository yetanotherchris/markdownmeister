import { useEffect, useRef } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { $prose } from '@milkdown/kit/utils'
import type { EditorView } from '@milkdown/kit/prose/view'
import { javascript } from '@codemirror/lang-javascript'
import { LanguageDescription } from '@codemirror/language'
import { applyToolbarLabels } from './toolbarLabels'
import { planTaskBackspace } from './taskBackspace'
import { tightListPlugins } from './tightList'
import { spellcheckPlugin, type SpellingMenuState } from './spellcheckPlugin'
import {
  visualSearchPlugin,
  openSearch,
  closeSearch,
  setSearchQuery,
  findNextMatch,
  findPreviousMatch,
  visualSearchIsOpen,
  type VisualSearchHandle,
  type VisualSearchSnapshot
} from '../search/visualSearch'
import { reconfigureEditor, isReconfigureSuppressed } from './markdownSyntaxRuntime'
import { recordParse, recordIncomingSerialization, endOpen } from './openPerformance'
import { applyCursorRestore, planBlockRestore, revealCaretInView } from './cursorRestore'
import type { VisualRestorePlan } from '../domain/caretSync'
import {
  markdownSyntaxInputRuleGate,
  setMarkdownSyntaxGateOptions
} from './markdownSyntaxInputRules'
import type { MarkdownSyntaxOptions } from './markdownSyntaxOptions'

export interface CursorState {
  cursorOffset: number
  scrollTop: number
}

interface CrepeHostProps {
  defaultValue: string
  active: boolean

  locked: boolean

  markdownOptions: MarkdownSyntaxOptions

  onSpellingMenu: (menu: SpellingMenuState | null) => void
  restoreCursor?: CursorState
  /** A mapped caret restore from the source caret's block, applied ahead of
   *  the stored offset and reported through onCursorSyncApplied once. */
  cursorSync?: VisualRestorePlan | null
  onCursorSyncApplied?: () => void
  onMarkdownUpdated: (markdown: string) => void
  onReady: (editor: Crepe) => void

  onBaselineCapture: (markdown: string, docRef: unknown) => void
  onCursorState: (cursor: CursorState) => void
  onRequestViewSource: () => void

  /** Receives the imperative search handle once the editor exists. */
  searchHandleRef?: React.MutableRefObject<VisualSearchHandle | null>
  /** Live search state for the panel (open, current of total). */
  onSearchState?: (snapshot: VisualSearchSnapshot) => void
  /** Increments to request opening search in this host; null does nothing. */
  findSignal?: number | null
}

const VIEW_SOURCE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
  </svg>
`

const codeBlockLanguages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'javascript'],
    extensions: ['js', 'mjs', 'cjs'],
    load: async () => javascript()
  })
]

export default function CrepeHost({
  defaultValue,
  active,
  locked,
  markdownOptions,
  onSpellingMenu,
  restoreCursor,
  cursorSync,
  onCursorSyncApplied,
  onMarkdownUpdated,
  onReady,
  onBaselineCapture,
  onCursorState,
  onRequestViewSource,
  searchHandleRef,
  onSearchState,
  findSignal
}: CrepeHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Crepe | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const scrollElementRef = useRef<HTMLElement | null>(null)
  const wasActiveRef = useRef(active)
  const onViewSourceRef = useRef(onRequestViewSource)
  onViewSourceRef.current = onRequestViewSource
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const onSpellingMenuRef = useRef(onSpellingMenu)
  onSpellingMenuRef.current = onSpellingMenu
  const onCursorSyncAppliedRef = useRef(onCursorSyncApplied)
  onCursorSyncAppliedRef.current = onCursorSyncApplied
  const onSearchStateRef = useRef(onSearchState)
  onSearchStateRef.current = onSearchState
  const handledFindRef = useRef<number | null>(null)

  function searchHandle(): VisualSearchHandle {
    const view = () => viewRef.current
    return {
      open: () => {
        const v = view()
        if (v) openSearch(v)
      },
      close: () => {
        const v = view()
        if (v) closeSearch(v, true)
      },
      setQuery: (query) => {
        const v = view()
        if (v) setSearchQuery(v, query)
      },
      next: () => {
        const v = view()
        if (v) findNextMatch(v)
      },
      previous: () => {
        const v = view()
        if (v) findPreviousMatch(v)
      }
    }
  }

  function applyInert() {
    const onInert = lockedRef.current
    const view = viewRef.current
    if (view) view.dom.toggleAttribute('inert', onInert)
    containerRef.current
      ?.querySelectorAll('.milkdown-top-bar')
      .forEach((bar) => bar.toggleAttribute('inert', onInert))
  }

  function applyCursorState(view: EditorView | null) {
    if (!view) return
    if (cursorSync) {
      const selection = planBlockRestore(
        view.state.doc,
        cursorSync.blockIndex,
        cursorSync.blockCount
      )
      if (selection) {
        // The mapped caret is revealed rather than paired with a stored
        // scroll.
        view.dispatch(view.state.tr.setSelection(selection))
        revealCaretInView(view, selection.head, scrollElementRef.current)
      }
      // A refused plan (count drift) is still consumed: a retained prime
      // would fire on some later, unrelated activation.
      onCursorSyncAppliedRef.current?.()
      if (selection) return
    }
    if (restoreCursor) applyCursorRestore(view, restoreCursor, scrollElementRef.current)
  }

  function captureCursorState(): CursorState {
    const view = viewRef.current
    const scrollElement = scrollElementRef.current
    return {
      cursorOffset: view ? view.state.selection.anchor : 0,
      scrollTop: scrollElement ? scrollElement.scrollTop : 0
    }
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      const { Crepe: CrepeClass } = await import('@milkdown/crepe')
      if (!mounted || !containerRef.current) return
      const crepe = new CrepeClass({
        root: containerRef.current,
        defaultValue,
        features: {
          // A persistent menu bar (headings + formatting buttons) replaces the
          // floating toolbar that pops up on selection, and the per-line
          // block-edit "+" handle.
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.BlockEdit]: false,
          [CrepeFeature.TopBar]: true
        },
        featureConfigs: {
          [CrepeFeature.CodeMirror]: { languages: codeBlockLanguages },
          [CrepeFeature.TopBar]: {
            buildTopBar(builder) {
              builder.addGroup('view', 'View').addItem('view-source', {
                icon: VIEW_SOURCE_ICON,
                active: () => false,
                onRun: () => {
                  onViewSourceRef.current()
                }
              })
            }
          }
        }
      })

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          if (mounted && !lockedRef.current && !isReconfigureSuppressed()) {
            onMarkdownUpdated(markdown)
          }
        })
      })

      // Tight/loose list serialization fix (tightList.ts): milkdown's default
      // bullet_list/list_item runners pass the `spread` attr through as a
      // string, which remark's stringifier treats as truthy and serializes as
      // a LOOSE list (blank lines between items). These overrides coerce it to
      // a real boolean so tight lists round-trip tight; genuinely loose lists
      // stay loose. Task-item handling is preserved via gfm's extension.
      tightListPlugins.forEach((plugin) => crepe.editor.use(plugin))

      crepe.editor.use($prose(() => spellcheckPlugin((menu) => onSpellingMenuRef.current(menu))))

      crepe.editor.use($prose(() => visualSearchPlugin((snapshot) => onSearchStateRef.current?.(snapshot))))

      setMarkdownSyntaxGateOptions(markdownOptions)
      crepe.editor.use(markdownSyntaxInputRuleGate)

      try {
        await crepe.create()
      } catch (error) {
        if (mounted) console.error('Editor initialization failed', error)
        crepe.destroy()
        return
      }
      if (!mounted) {
        crepe.destroy()
        return
      }
      editorRef.current = crepe
      const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx))
      viewRef.current = view
      if (searchHandleRef) searchHandleRef.current = searchHandle()
      recordParse()
      scrollElementRef.current = view.dom.closest('.editor-host') ?? view.dom.parentElement
      view.dom.spellcheck = false
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Backspace') return
        const tr = planTaskBackspace(view.state)
        if (!tr) return
        event.preventDefault()
        event.stopImmediatePropagation()
        view.dispatch(tr)
      }
      view.dom.addEventListener('keydown', onKeyDown, true)
      const topBar = containerRef.current?.querySelector<HTMLElement>('.milkdown-top-bar')
      if (topBar) applyToolbarLabels(topBar)
      reconfigureEditor(crepe, markdownOptions, {
        sourceMarkdown: defaultValue,
        suppressEmission: false
      })
      recordIncomingSerialization()
      onReady(crepe)
      endOpen()
      onBaselineCapture(crepe.getMarkdown(), view.state.doc)
      applyInert()
      // `active` is the mount-time prop: if the view flipped to source while
      // create() was pending, this closure still sees true. lockedRef tracks
      // the live lock, so restoring the caret or focusing here would apply a
      // stored scroll to the locked container and steal focus from the
      // source surface.
      if (active && !lockedRef.current) {
        applyCursorState(view)
        view.focus()
      }
    }

    init()

    return () => {
      mounted = false
      const editor = editorRef.current
      editorRef.current = null
      viewRef.current = null
      scrollElementRef.current = null
      if (searchHandleRef) searchHandleRef.current = null
      // Same-tab replacement unmounts an entire Milkdown editor. Releasing its
      // resources during idle time lets the replacement editor paint first.
      window.requestIdleCallback(() => editor?.destroy(), { timeout: 1_000 })
    }
  }, [])

  useEffect(() => {
    applyInert()
  }, [locked])

  // Search state never carries across tab switches, view switches, or editor
  // replacement (FR-013): closing dispatches a meta-only transaction, which
  // leaves content, dirty state, and undo history untouched.
  useEffect(() => {
    if (!active || locked) {
      const view = viewRef.current
      if (view && visualSearchIsOpen(view)) closeSearch(view)
    }
  }, [active, locked])

  useEffect(() => {
    if (findSignal == null || findSignal === handledFindRef.current) return
    handledFindRef.current = findSignal
    if (!active || locked) return
    searchHandleRef?.current?.open()
  }, [findSignal, active, locked, searchHandleRef])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (active) {
      applyCursorState(view)
      view.focus()
    } else if (wasActiveRef.current) {
      onCursorState(captureCursorState())
    }
    wasActiveRef.current = active
  }, [active])

  return <div ref={containerRef} />
}
