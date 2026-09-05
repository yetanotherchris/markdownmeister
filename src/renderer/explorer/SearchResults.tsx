import { useMemo, useState } from 'react'
import { FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { highlightSegments, summarize, truncateSnippet } from './searchResultModel'
import type { SearchSection } from './searchResultModel'

interface SearchResultsProps {
  sections: SearchSection[]
  term: string
  onOpenFile: (path: string) => void
}

/** The VS Code-style report shown in place of the tree while a term is active:
 *  a summary line, one collapsible section per matched file (icon, name,
 *  directory, chevron, hit-count badge), and snippet lines with the term
 *  highlighted and long lines truncated with ellipses. */
export default function SearchResults({ sections, term, onOpenFile }: SearchResultsProps) {
  const summary = useMemo(() => summarize(sections), [sections])
  const matchWord = summary.matches === 1 ? 'match' : 'matches'
  const fileWord = summary.files === 1 ? 'file' : 'files'

  return (
    <div className="search-results" data-testid="search-results">
      <div className="search-results-summary" data-testid="search-results-summary">
        {summary.matches} {matchWord} in {summary.files} {fileWord}
      </div>
      <div className="search-results-list">
        {sections.map((section) => (
          <ResultSection key={section.path} section={section} term={term} onOpenFile={onOpenFile} />
        ))}
      </div>
    </div>
  )
}

function ResultSection({
  section,
  term,
  onOpenFile
}: {
  section: SearchSection
  term: string
  onOpenFile: (path: string) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="search-result-section" data-testid="search-result-section">
      <div className="search-result-header">
        <button
          type="button"
          className="search-result-chevron"
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          type="button"
          className="search-result-open"
          onClick={() => onOpenFile(section.path)}
        >
          <span className="search-result-icon" aria-hidden="true">
            <FileText size={14} />
          </span>
          <span className="search-result-name">{section.name}</span>
          {section.directory !== '' && (
            <span className="search-result-dir">{section.directory}</span>
          )}
          <span className="search-result-badge" data-testid="search-result-badge">
            {section.count}
          </span>
        </button>
      </div>
      {open && section.lines.length > 0 && (
        <div className="search-result-snippets">
          {section.lines.map((line, i) => (
            <button
              key={i}
              type="button"
              className="search-result-snippet"
              onClick={() => onOpenFile(section.path)}
            >
              <SnippetLine line={line} term={term} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SnippetLine({ line, term }: { line: string; term: string }) {
  const text = truncateSnippet(line, term, 140)
  const segments = highlightSegments(text, term)
  return (
    <span className="search-result-snippet-text">
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className="search-result-mark">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}
