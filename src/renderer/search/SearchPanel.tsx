import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
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
  dock: SearchPanelDock
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

/** The find box docked over the editing area. Live matching: every keystroke
 *  reports the query; Enter/Shift+Enter and the buttons navigate; Escape
 *  closes. Zero matches render calmly: the count is replaced by a muted
 *  note and navigation is disabled. */
export default function SearchPanel({
  current,
  total,
  dock,
  onQueryChange,
  onNext,
  onPrevious,
  onClose
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [top, setTop] = useState(dock.mode === 'fixed' ? dock.top : PANEL_TOP_FALLBACK_PX)
  const inputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
  )
}
