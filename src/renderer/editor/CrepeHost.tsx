import { useEffect, useRef } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { $prose } from '@milkdown/kit/utils'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { javascript } from '@codemirror/lang-javascript'
import { LanguageDescription } from '@codemirror/language'
import { applyToolbarLabels } from './toolbarLabels'
import { planTaskBackspace } from './taskBackspace'
import { tightListPlugins } from './tightList'
import { spellcheckPlugin, type SpellingMenuState } from './spellcheckPlugin'
import { reconfigureEditor, isReconfigureSuppressed } from './markdownSyntaxRuntime'
import { recordParse, recordIncomingSerialization, endOpen } from './openPerformance'
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
  /** True while this tab shows the source overlay. Editor-originated
   *  markdownUpdated emissions are suppressed (their 200 ms debounce could
   *  otherwise clobber raw source edits) and the covered editor is made
   *  inert so it leaves the keyboard and accessibility tree (FR-009). */
  locked: boolean
  /** Spec 030: the markdown syntax options this editor is created with. A
   *  runtime toggle reconfigures the live editor in place, so this prop is
   *  read once at mount for the initial pipeline. */
  markdownOptions: MarkdownSyntaxOptions
  /** Spec 020 (JS spellchecker): called with the right-click correction menu
   *  (or `null` to dismiss). Owned by the spellcheck plugin. */
  onSpellingMenu: (menu: SpellingMenuState | null) => void
  restoreCursor?: CursorState
  onMarkdownUpdated: (markdown: string) => void
  onReady: (editor: Crepe) => void
  /** Spec 033: the second argument is the freshly mounted view's ProseMirror
   *  document reference, recorded so dirty checks can prove "no edit since
   *  baseline" by identity instead of re-serializing (contract C2). */
  onBaselineCapture: (markdown: string, docRef: unknown) => void
  onCursorState: (cursor: CursorState) => void
  onRequestViewSource: () => void
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
  onMarkdownUpdated,
  onReady,
  onBaselineCapture,
  onCursorState,
  onRequestViewSource
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

  // While the source overlay covers this editor, make the ProseMirror
  // contenteditable and the Crepe top bar non-focusable (inert) so Tab/AT
  // users do not walk through invisible, covered controls behind it (FR-009).
  // The source textarea is NOT inside this path and stays fully interactive.
  function applyInert() {
    const onInert = lockedRef.current
    const view = viewRef.current
    if (view) view.dom.toggleAttribute('inert', onInert)
    containerRef.current
      ?.querySelectorAll('.milkdown-top-bar')
      .forEach((bar) => bar.toggleAttribute('inert', onInert))
  }

  function applyCursorState(view: EditorView | null) {
    if (!view || !restoreCursor) return
    const { cursorOffset, scrollTop } = restoreCursor
    if (cursorOffset > 0) {
      const pos = Math.min(cursorOffset, view.state.doc.content.size)
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
    }
    if (scrollTop > 0 && scrollElementRef.current) {
      scrollElementRef.current.scrollTop = scrollTop
    }
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
            // Spec 002: a "View source" button appended to the top bar. Crepe
            // invokes buildTopBar after composing its default groups, so the
            // extra group renders last (research.md R7).
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
          // Drop emissions while the tab is in source view: the listener's
          // 200 ms debounce-outstanding changes is not the store's state, so a
          // late emission from a superseded edit must not overwrite the raw
          // text the user is typing (research R3, 2026-08-02 data-loss fix).
          // Spec 030: also drop the re-parse emission from a settings toggle
          // (research R3), so a syntax reconfiguration never touches the store.
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

      // Spec 020 (JS spellchecker): whole-document checking + the correction
      // menu. The wrapper reads the latest onSpellingMenu prop via the ref.
      crepe.editor.use($prose(() => spellcheckPlugin((menu) => onSpellingMenuRef.current(menu))))

      // Spec 030 (research R4): gate the syntax-producing input rules so typing
      // a disabled syntax never auto-formats it. Registered before create so
      // its SchemaReady continuation wraps the `$inputRule` pushes (which were
      // registered during construction) before editorState reads the slice.
      // The gate's handlers consult the shared options ref at invoke time, so
      // the initial options must be set before create as well.
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
      // Spec 033 (SC-002): the constructor parsed `defaultValue` — count the
      // one full interpretation pass over incoming content.
      recordParse()
      scrollElementRef.current = view.dom.closest('.editor-host') ?? view.dom.parentElement
      // Spec 020 (2026-08-07): the JS spellchecker marks misspellings itself,
      // so Chromium's native markers are switched OFF here to avoid double
      // underlines. The source view keeps native spellchecking (FR-007).
      view.dom.spellcheck = false
      // Spec 002, US5 (FR-016/017): Backspace at the start of an empty task
      // item removes it. Bound on `view.dom` in the CAPTURE phase so this runs
      // before ProseMirror's own keydown handler registers the key (the editor
      // attaches its listener during crepe.create(), earlier than this one);
      // when the keystroke is handled, stopImmediatePropagation ensures the
      // editor never produces its own join transaction. Everything else falls
      // through (FR-018).
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Backspace') return
        const tr = planTaskBackspace(view.state)
        if (!tr) return
        event.preventDefault()
        event.stopImmediatePropagation()
        view.dispatch(tr)
      }
      view.dom.addEventListener('keydown', onKeyDown, true)
      // Spec 002: Crepe's TopBar renders controls with no title/aria-label;
      // assign them by DOM order now that the tree exists (toolbarLabels.ts).
      const topBar = containerRef.current?.querySelector<HTMLElement>('.milkdown-top-bar')
      if (topBar) applyToolbarLabels(topBar)
      // Spec 030: build the conditional remark pipeline at create — reconfigure
      // the freshly parsed editor in place so the initial pipeline matches the
      // persisted options (defaults all-on are a no-op re-parse). This runs
      // BEFORE the baseline capture so the baseline reflects the final pipeline.
      // The raw `defaultValue` is the source: `getMarkdown()` would have already
      // emitted an autolink URL as `<url>` (the default link handler renders
      // url === text as a bare angle-bracketed link), which a re-parse could not undo.
      reconfigureEditor(crepe, markdownOptions, {
        sourceMarkdown: defaultValue,
        suppressEmission: false
      })
      // The listener plugin only emits markdownUpdated on the first *edit*
      // (its handler is debounced by 200 ms and no doc-changing transaction
      // fires on load), so the baseline cannot come from the first emission.
      // Reading the freshly parsed content directly is the reliable source
      // (research.md R4, verified in Phase 5). Spec 033: this stays the single
      // full serialization of incoming content per open (research R3, SC-003),
      // and the parsed doc reference rides along for the dirty fast path.
      // onReady runs FIRST because it registers the pool entry the identity is
      // recorded into; both store updates land in the same React batch.
      recordIncomingSerialization()
      onReady(crepe)
      onBaselineCapture(crepe.getMarkdown(), view.state.doc)
      // Spec 033 (contract C5): presentation complete — close the open-timing
      // measurement opened at open-gesture commit (no-op without one).
      endOpen()
      applyInert()
      if (active) {
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
      // Same-tab replacement unmounts an entire Milkdown editor. Releasing its
      // resources during idle time lets the replacement editor paint first.
      window.requestIdleCallback(() => editor?.destroy(), { timeout: 1_000 })
    }
  }, [])

  useEffect(() => {
    // Reflect view switches (formatted → source / source → formatted) onto the
    // cover-locked elements without remounting the editor.
    applyInert()
  }, [locked])

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
