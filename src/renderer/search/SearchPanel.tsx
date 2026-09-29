import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import './search.css'

const PANEL_TOP_FALLBACK_PX = 8
const PANEL_TOP_GAP_PX = 8

/** Where the panel docks. `measure` tracks the host's own top bar (the visual
 *  view's Milkdown bar); `fixed` pins the panel at a constant offset below the
 *  area's own bar (the source view's toolbar). */
export type SearchPanelDock =
  { mode: 'measure'; hostRef: React.RefObject<HTMLElement | null> } | { mode: 'fixed'; top: number }

export interface SearchPanelProps {
  /** Zero-based index of the current match. */
  current: number
  total: number
  /** Whether the replace row is revealed; owned by the editing surface so a
   *  replace request (Ctrl+H) can reveal it and a close can reset it. */
  replaceOpen: boolean
  dock: SearchPanelDock
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
  onToggleReplace: (open: boolean) => void
  onReplacementChange: (text: string) => void
  onReplace: () => void
  onReplaceAll: () => void
}

/** The find and replace box docked over the editing area. Live matching: every
 *  keystroke reports the query; Enter/Shift+Enter and the buttons navigate;
 *  Escape closes. A toggle reveals the replace row, whose controls are inert
 *  while nothing matches. Zero matches render calmly: the count is replaced by
 *  a muted note and the controls are disabled. */
export default function SearchPanel({
  current,
  total,
  replaceOpen,
  dock,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
  onToggleReplace,
  onReplacementChange,
  onReplace,
  onReplaceAll
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [top, setTop] = useState(dock.mode === 'fixed' ? dock.top : PANEL_TOP_FALLBACK_PX)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (dock.mode === 'fixed') {
      setTop(dock.top)
      return
    }
    const updateTop = () => {
      const host = dock.hostRef.current
      const area = host?.parentElement
      if (!host || !area) return
      const bar = host.querySelector('.milkdown-top-bar')?.getBoundingClientRect()
      // A zero-size bar means it is display:none (formatting bar off): dock
      // near the top of the area instead of computing a negative, clipped
      // offset.
      setTop(
        !bar || bar.height === 0
          ? PANEL_TOP_FALLBACK_PX
          : bar.bottom - area.getBoundingClientRect().top + PANEL_TOP_GAP_PX
      )
    }
    updateTop()
    // The bar wraps to two rows in narrow editors, so its own size tracks the
    // layout changes that move it; the area's top can move independently.
    const bar = dock.hostRef.current?.querySelector('.milkdown-top-bar')
    const observer = new ResizeObserver(updateTop)
    if (bar) observer.observe(bar)
    window.addEventListener('resize', updateTop)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTop)
    }
  }, [dock])

  // On mount and on every toggle, focus the input the user is now working in:
  // the replacement field when the row is revealed, the query field otherwise.
  useEffect(() => {
    if (replaceOpen) replaceInputRef.current?.focus()
    else inputRef.current?.focus()
  }, [replaceOpen])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) onPrevious()
      else onNext()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="search-panel" style={{ top }} data-testid="search-panel" role="search">
      <div className="search-row">
        <button
          type="button"
          className="search-button"
          aria-label="Toggle replace"
          aria-pressed={replaceOpen}
          title="Toggle replace (Ctrl+H)"
          onClick={() => onToggleReplace(!replaceOpen)}
          data-testid="search-replace-toggle"
        >
          {replaceOpen ? (
            <ChevronDownIcon aria-hidden="true" />
          ) : (
            <ChevronRightIcon aria-hidden="true" />
          )}
        </button>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          aria-label="Find"
          placeholder="Find"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            onQueryChange(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          data-testid="search-input"
        />
        <span className="search-count" data-testid="search-count" aria-live="polite">
          {total > 0 ? `${current + 1} of ${total}` : query.trim() !== '' ? 'No matches' : ''}
        </span>
        <button
          type="button"
          className="search-button"
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
          onClick={onPrevious}
          disabled={total === 0}
          data-testid="search-prev"
        >
          <ChevronUpIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="search-button"
          aria-label="Next match"
          title="Next match (Enter)"
          onClick={onNext}
          disabled={total === 0}
          data-testid="search-next"
        >
          <ChevronDownIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="search-button"
          aria-label="Close search"
          title="Close (Escape)"
          onClick={onClose}
          data-testid="search-close"
        >
          <XMarkIcon aria-hidden="true" />
        </button>
      </div>
      {replaceOpen && (
        <div className="search-row search-replace-row">
          <input
            ref={replaceInputRef}
            type="text"
            className="search-input"
            aria-label="Replace with"
            placeholder="Replace"
            spellCheck={false}
            value={replacement}
            onChange={(event) => {
              setReplacement(event.target.value)
              onReplacementChange(event.target.value)
            }}
            onKeyDown={handleKeyDown}
            data-testid="search-replace-input"
          />
          <button
            type="button"
            className="search-button search-replace-button"
            title="Replace"
            onClick={onReplace}
            disabled={total === 0}
            data-testid="search-replace"
          >
            Replace
          </button>
          <button
            type="button"
            className="search-button search-replace-button"
            title="Replace all"
            onClick={onReplaceAll}
            disabled={total === 0}
            data-testid="search-replace-all"
          >
            Replace All
          </button>
        </div>
      )}
    </div>
  )
}
