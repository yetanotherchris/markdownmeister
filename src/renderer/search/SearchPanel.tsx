import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import './search.css'

export interface SearchPanelProps {
  /** Zero-based index of the current match. */
  current: number
  total: number
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
  onQueryChange,
  onNext,
  onPrevious,
  onClose
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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
    <div className="search-panel" data-testid="search-panel" role="search">
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
