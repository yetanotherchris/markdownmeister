import { useEffect, useRef } from 'react'
import type { SpellingMenuState } from './spellcheckPlugin'
import './editor.css'

interface SpellingMenuProps {
  menu: SpellingMenuState
  onDismiss: () => void
}


function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}


export default function SpellingMenu({ menu, onDismiss }: SpellingMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  // Position with fixed layout; clamp to the viewport (approximate menu size).
  const left = clamp(menu.x, window.innerWidth - 220)
  const top = clamp(menu.y, window.innerHeight - 180)

  return (
    <>
      <div className="spelling-menu-backdrop" onClick={onDismiss} aria-hidden="true" />
      <div
        ref={rootRef}
        className="spelling-menu"
        style={{ left, top }}
        role="menu"
        aria-label={`Suggestions for ${menu.word}`}
        data-testid="spelling-menu"
      >
        <div className="spelling-menu-word" role="presentation">
          {menu.word}
        </div>
        {menu.suggestions.length > 0 ? (
          menu.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="menuitem"
              onClick={() => menu.apply(suggestion)}
            >
              {suggestion}
            </button>
          ))
        ) : (
          <div className="spelling-menu-none">No suggestions</div>
        )}
        <div className="spelling-menu-sep" role="separator" />
        <button type="button" role="menuitem" onClick={menu.addToDictionary}>
          Add to dictionary
        </button>
      </div>
    </>
  )
}
