import { PlusIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { DocumentState } from '../state/documents'
import './tabs.css'

interface TabBarProps {
  documents: DocumentState[]
  activeId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function TabBar({ documents, activeId, onActivate, onClose, onNew }: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Open documents">
      {documents.map((doc) => {
        const active = doc.id === activeId
        return (
          <div
            key={doc.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={active ? 'tab active' : 'tab'}
            title={doc.path ?? doc.title}
            onClick={() => onActivate(doc.id)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate(doc.id)
              }
            }}
          >
            {active && <PencilSquareIcon className="tab-edit-icon" aria-hidden="true" />}
            <span className="tab-title">{doc.title}</span>
            {doc.externalState === 'deletedOnDisk' && (
              <span
                className="tab-warning"
                aria-label="deleted on disk"
                title="The file was deleted or renamed on disk"
              >
                !
              </span>
            )}
            {doc.dirty && (
              <span className="tab-dirty" aria-label="unsaved changes" title="Unsaved changes">
                •
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${doc.title}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(doc.id)
              }}
            >
              <XMarkIcon className="tab-close-icon" aria-hidden="true" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        className="tab-new"
        aria-label="New file"
        title="New file"
        onClick={onNew}
      >
        <PlusIcon className="tab-new-icon" aria-hidden="true" />
      </button>
    </div>
  )
}
