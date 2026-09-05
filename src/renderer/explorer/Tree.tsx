import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tree as ArboristTree, NodeApi, TreeApi } from 'react-arborist'
import type { RowRendererProps, NodeRendererProps } from 'react-arborist'
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Search, X } from 'lucide-react'
import type { TreeNode } from '../state/workspace'
import { findNodeById, parentPathOf } from '../state/workspace'
import { useElementSize } from '../hooks/useElementSize'
import { treeMoveTarget, treeWouldMoveIntoOwnDescendant } from './treeMove'
import { treeRenameLabel } from './treeRename'
import { nameSearchMatch, hasNameMatch } from './explorerSearch'
import { isOpenableFile } from './openGesture'
import type { FileOpenGesture } from './openGesture'
import type { EntryKind } from '../../shared/ipc-contract'
import './Tree.css'

interface TreeProps {
  data: TreeNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onActivate: (id: string) => void
  onToggle: (id: string, isOpen: boolean) => void
  /** App asks the tree to start inline editing on this node (create flow). */
  pendingEditId: string | null
  /** Rename committed; resolve true when applied (false keeps the old name). */
  onRename: (node: TreeNode, newName: string) => Promise<boolean>

  onEditingCancelled: (id: string) => void
  onDeleteRequest: (node: TreeNode) => void
  onCreateRequest: (parent: TreeNode | null, kind: EntryKind) => void
  onMove: (id: string, targetParentId: string) => void

  onOpen: (path: string) => void

  onViewSource: (path: string) => void

  onReveal: (node: TreeNode) => void

  onOpenNewTab: (node: TreeNode) => void

  onFileOpen: (node: TreeNode, gesture: FileOpenGesture) => void

  apiRef?: React.MutableRefObject<TreeApi<TreeNode> | null> | null

  /** Live search term for the explorer filter (FR-001/FR-002). */
  searchTerm: string
  onSearchTermChange: (term: string) => void
}

interface ContextMenuState {
  x: number
  y: number
  node: TreeNode | null
}

/**
 * FR-008: capture the selection the moment a term first becomes non-empty and
 * reapply it when the term returns to empty. The library restores the open
 * map itself; selection is the one part it does not, and clicking a match
 * while filtering would otherwise leave the post-filter selection behind.
 */
function usePreFilterSelectionRestore(
  filtering: boolean,
  selectedId: string | null,
  data: TreeNode[],
  onSelect: (id: string | null) => void
): void {
  const preFilterSelectionRef = useRef<string | null | undefined>(undefined)
  const filteringRef = useRef(false)
  useEffect(() => {
    if (filtering && !filteringRef.current) {
      preFilterSelectionRef.current = selectedId
    } else if (!filtering && filteringRef.current) {
      const restore = preFilterSelectionRef.current
      // The pre-filter entry may have been deleted or renamed while the
      // filter was active; a dead id must not be re-selected.
      if (restore !== undefined && (restore === null || findNodeById(data, restore))) {
        onSelect(restore)
      }
      preFilterSelectionRef.current = undefined
    }
    filteringRef.current = filtering
  }, [filtering, selectedId, data, onSelect])
}

/** The entry being created or renamed stays reachable while the filter hides
 *  it, otherwise inline editing of a new placeholder times out and the create
 *  flow deletes the fresh file (the tree api only resolves visible nodes). */
function searchMatchFor(
  node: NodeApi<TreeNode>,
  term: string,
  editingId: string | null
): boolean {
  if (node.data.id === editingId) return true
  return nameSearchMatch(node.data.name, term)
}

interface ExplorerSearchInputProps {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  onEscape: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

/** The labelled search row above the tree (FR-001). Escape clears the term and
 *  returns focus to the tree (FR-014); the clear control keeps focus in the
 *  input so the user can type a fresh term. */
function ExplorerSearchInput({
  searchTerm,
  onSearchTermChange,
  onEscape,
  inputRef
}: ExplorerSearchInputProps) {
  return (
    <div className="explorer-search" onContextMenu={(e) => e.stopPropagation()}>
      <label className="explorer-search-label" htmlFor="explorer-search-input">
        Search files
      </label>
      <div className="explorer-search-box">
        <Search size={14} className="explorer-search-icon" aria-hidden="true" />
        <input
          id="explorer-search-input"
          ref={inputRef}
          type="text"
          className="explorer-search-input"
          placeholder="Search files"
          aria-label="Search files"
          spellCheck={false}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onEscape()
            }
          }}
          data-testid="explorer-search-input"
        />
        {searchTerm !== '' && (
          <button
            type="button"
            className="explorer-search-clear"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => {
              onSearchTermChange('')
              inputRef.current?.focus()
            }}
            data-testid="explorer-search-clear"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  node: NodeApi<TreeNode>
  style: React.CSSProperties
  dragHandle?: (el: HTMLDivElement | null) => void
  onRowContextMenu: (node: TreeNode, x: number, y: number) => void
}

function RenameInput({ node }: { node: NodeApi<TreeNode> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const closedRef = useRef(false)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const commit = () => {
    if (closedRef.current) return
    closedRef.current = true
    node.submit(inputRef.current?.value ?? '')
  }

  const cancel = () => {
    if (closedRef.current) return
    closedRef.current = true
    node.reset()
  }

  // The placeholder flow names a brand-new entry; a real row is being renamed.
  const label = treeRenameLabel(node.data)

  return (
    <input
      ref={inputRef}
      className="tree-node-input"
      defaultValue={node.data.name}
      aria-label={label}
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (!node.isEditing) return
        const next = e.relatedTarget as HTMLElement | null
        // Stay in the edit when the blur target is elsewhere in the tree or
        // a context menu, but NOT the search box: moving to the search box is
        // an explicit intent to search, and stealing focus back would make
        // the next keystroke (e.g. Escape) cancel the pending edit.
        if (
          next &&
          !next.closest('.explorer-search') &&
          (next.closest('.tree-container') || next.closest('.context-menu'))
        ) {
          inputRef.current?.focus()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        else if (e.key === 'Escape') cancel()
        e.stopPropagation()
      }}
    />
  )
}

function TreeNode({ node, style, dragHandle, onRowContextMenu }: TreeNodeProps) {
  const isDir = node.data.kind === 'directory'

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`tree-node ${node.isSelected ? 'selected' : ''} ${node.isLeaf ? 'leaf' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onRowContextMenu(node.data, e.clientX, e.clientY)
      }}
    >
      {isDir && (
        <button
          type="button"
          className="tree-node-toggle"
          aria-label={node.isOpen ? 'Collapse' : 'Expand'}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            node.toggle()
          }}
        >
          {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
      <span className="tree-node-icon" aria-hidden="true">
        {isDir
          ? (node.isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
          : <FileText size={14} />}
      </span>
      {node.isEditing ? (
        <RenameInput node={node} />
      ) : (
        <span className="tree-node-name">{node.data.name}</span>
      )}
    </div>
  )
}

interface TreeRowProps extends RowRendererProps<TreeNode> {
  onKeyboardMenu: (node: TreeNode, x: number, y: number) => void
  onRenameKey: (node: TreeNode) => void
  onDeleteKey: (node: TreeNode) => void

  onOpenNewTab: (node: TreeNode) => void

  onFileOpen: (node: TreeNode, gesture: FileOpenGesture) => void
}

/**
 * Module-scope row component: a stable function identity keeps react-arborist
 * from remounting every visible row on each Tree re-render (a fresh inline
 * Row would be a new component type per render, remounting all rows' DOM and
 * dropping the inline-rename caret).
 */
function TreeRow({ node, attrs, innerRef, children, onKeyboardMenu, onRenameKey, onDeleteKey, onOpenNewTab, onFileOpen }: TreeRowProps) {
  const isDir = node.data.kind === 'directory'

  // Keyboard access to the row operations (WCAG 2.1.1): F2 renames, Delete
  // opens the confirmed-delete flow, Shift+F10/Menu opens the context menu
  // anchored to this row.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'F2') {
      e.preventDefault()
      onRenameKey(node.data)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      onDeleteKey(node.data)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      onKeyboardMenu(node.data, rect.x + 24, rect.y + rect.height / 2)
    }
  }

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (isOpenableFile(node.data)) {
      node.select()
      onFileOpen(node.data, e.detail >= 2 ? 'double-click' : 'single-click')
      return
    }
    if (e.detail >= 2) {
      node.toggle()
      return
    }
    node.handleClick(e)
  }

  return (
    <div
      ref={innerRef}
      style={attrs.style}
      className={attrs.className}
      tabIndex={attrs.tabIndex}
      role="treeitem"
      aria-level={node.level + 1}
      aria-selected={node.isSelected}
      aria-expanded={isDir ? node.isOpen : undefined}
      onClick={handleRowClick}
      onKeyDown={onKeyDown}
      onAuxClick={(e) => {
        if (e.button === 1 && node.data.kind === 'file') {
          e.preventDefault()
          onOpenNewTab(node.data)
        }
      }}
    >
      {children}
    </div>
  )
}

export default function Tree({
  data,
  selectedId,
  onSelect,
  onActivate,
  onToggle,
  pendingEditId,
  onRename,
  onEditingCancelled,
  onDeleteRequest,
  onCreateRequest,
  onMove,
  onOpen,
  onViewSource,
  onReveal,
  onOpenNewTab,
  onFileOpen,
  apiRef,
  searchTerm,
  onSearchTermChange
}: TreeProps) {
  const [containerRef] = useElementSize<HTMLDivElement>()
  const [treeBodyRef, treeBodySize] = useElementSize<HTMLDivElement>()
  const treeRef = useRef<TreeApi<TreeNode> | null>(null)
  if (apiRef) apiRef.current = treeRef.current
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingIdRef = useRef(editingId)
  editingIdRef.current = editingId
  const editingInFlightRef = useRef(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const filtering = searchTerm.trim() !== ''
  usePreFilterSelectionRestore(filtering, selectedId, data, onSelect)

  const focusTree = useCallback(() => {
    containerRef.current?.querySelector<HTMLElement>('[role="tree"]')?.focus()
  }, [])

  const handleSearchEscape = useCallback(() => {
    onSearchTermChange('')
    focusTree()
  }, [focusTree, onSearchTermChange])

  const handleSearchMatch = useCallback(
    (node: NodeApi<TreeNode>) => searchMatchFor(node, searchTerm, editingId),
    [searchTerm, editingId]
  )

  const showNoMatchState = filtering && !hasNameMatch(data, searchTerm) && !editingId

  useEffect(() => {
    if (!pendingEditId || editingIdRef.current === pendingEditId) return
    setEditingId(pendingEditId)
  }, [pendingEditId])

  const startEditing = useCallback(async (id: string) => {
    if (editingInFlightRef.current) return
    editingInFlightRef.current = true
    try {
      let node = treeRef.current?.get(id)
      if (!node) {
        // The node exists in the data but its parent is closed in arborist's
        // own visibility state (create flow). Opening the parent fires our
        // onToggle, which lazy-loads the folder if needed and then leaves the
        // already-loaded data alone, see App.handleTreeToggle.
        const parent = parentPathOf(id)
        if (parent) treeRef.current?.open(parent)
        for (let i = 0; i < 20 && !node; i++) {
          await new Promise((resolve) => setTimeout(resolve, 25))
          node = treeRef.current?.get(id)
        }
      }
      if (!node) {
        onEditingCancelled(id)
        setEditingId((current) => (current === id ? null : current))
        return
      }
      const result = await node.edit()
      if (result.cancelled) {
        onEditingCancelled(id)
      }
      setEditingId((current) => (current === id ? null : current))
    } finally {
      editingInFlightRef.current = false
    }
  }, [onEditingCancelled])

  useEffect(() => {
    if (editingId) {
      // The node exists only after the reducer applied the INSERT_ENTRY, so
      // wait a frame for react-arborist to pick it up.
      const timer = setTimeout(() => {
        startEditing(editingId)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [editingId, startEditing])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    if (!contextMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    const onClick = () => closeContextMenu()
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    window.addEventListener('blur', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
      window.removeEventListener('blur', onClick)
    }
  }, [contextMenu, closeContextMenu])

  const handleSelect = useCallback((nodes: NodeApi<TreeNode>[]) => {
    const first = nodes[0]
    onSelect(first?.id ?? null)
  }, [onSelect])

  const handleActivate = useCallback((node: NodeApi<TreeNode>) => {
    onActivate(node.id)
  }, [onActivate])

  const handleToggle = useCallback((id: string) => {
    const node = findNodeById(data, id)
    if (!node) return
    onToggle(id, node.loadState === 'loaded')
  }, [data, onToggle])

  const handleRename = useCallback(async (args: {
    id: string
    name: string
    node: NodeApi<TreeNode>
  }) => {
    const node = findNodeById(data, args.id)
    if (!node) return
    await onRename(node, args.name)
  }, [data, onRename])

  const handleMove = useCallback((args: {
    dragIds: string[]
    dragNodes: NodeApi<TreeNode>[]
    parentId: string | null
    parentNode: NodeApi<TreeNode> | null
    index: number
  }) => {
    // A drop on empty space targets the root: parentNode is the internal root
    // node (its data has no kind), which maps to the workspace root ''.
    const targetParentId = args.parentNode && !args.parentNode.isRoot
      ? args.parentNode.data.id
      : ''
    for (const id of args.dragIds) {
      const target = treeMoveTarget(id, targetParentId)
      if (!target) continue
      onMove(id, targetParentId)
    }
  }, [onMove])

  const handleRowContextMenu = useCallback((node: TreeNode, x: number, y: number) => {
    setContextMenu({ x, y, node })
  }, [])

  const handleRenameKey = useCallback((node: TreeNode) => {
    startEditing(node.id)
  }, [startEditing])

  const handleDeleteKey = useCallback((node: TreeNode) => {
    onDeleteRequest(node)
  }, [onDeleteRequest])

  const handleKeyboardMenu = useCallback((node: TreeNode, x: number, y: number) => {
    setContextMenu({ x, y, node })
  }, [])

  // Stable render callbacks: fresh identities on every Tree render would make
  // react-arborist remount every visible row (perf M1), rows are keyed by
  // node id, but component-type identity changes force full remounts.
  const renderNode = useCallback((nodeProps: NodeRendererProps<TreeNode>) => (
    <TreeNode
      {...nodeProps}
      onRowContextMenu={handleRowContextMenu}
    />
  ), [handleRowContextMenu])

  const renderRow = useCallback((rowProps: RowRendererProps<TreeNode>) => (
    <TreeRow
      {...rowProps}
      onKeyboardMenu={handleKeyboardMenu}
      onRenameKey={handleRenameKey}
      onDeleteKey={handleDeleteKey}
      onOpenNewTab={onOpenNewTab}
      onFileOpen={onFileOpen}
    />
  ), [handleKeyboardMenu, handleRenameKey, handleDeleteKey, onOpenNewTab, onFileOpen])

  const disableDrop = useCallback(({ parentNode, dragNodes }: {
    parentNode: NodeApi<TreeNode>
    dragNodes: NodeApi<TreeNode>[]
  }) => {
    if (!parentNode.isRoot && parentNode.data.kind !== 'directory') return true
    return dragNodes.some(dn =>
      parentNode.isRoot ? false : treeWouldMoveIntoOwnDescendant(dn.id, parentNode.data.id)
    )
  }, [])

  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node: null })
  }, [])

  const menuItem = (label: string, onClick: () => void) => (
    <button
      type="button"
      className="context-menu-item"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation()
        closeContextMenu()
        onClick()
      }}
    >
      {label}
    </button>
  )

  const revealLabel =
    window.api.platform === 'darwin'
      ? 'Reveal in Finder'
      : window.api.platform === 'win32'
        ? 'Reveal in Explorer'
        : 'Reveal in file manager'

  const menu = contextMenu && (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      role="menu"
      aria-label="Entry actions"
    >
      {contextMenu.node && (
        <div className="context-menu-title" aria-hidden="true">
          {contextMenu.node.name}
        </div>
      )}
      {(!contextMenu.node || contextMenu.node.kind === 'directory') && (
        <>
          {menuItem('New File', () => onCreateRequest(contextMenu.node, 'file'))}
          {menuItem('New Folder', () => onCreateRequest(contextMenu.node, 'directory'))}
        </>
      )}
      {contextMenu.node && (
        <>
          <div className="context-menu-separator" />
          {contextMenu.node.kind === 'file' && (
            <>
              {menuItem('Open', () => onOpen(contextMenu.node!.id))}
              {menuItem('View source', () => onViewSource(contextMenu.node!.id))}
              <div className="context-menu-separator" />
            </>
          )}
          {menuItem(revealLabel, () => onReveal(contextMenu.node!))}
          {menuItem('Rename', () => startEditing(contextMenu.node!.id))}
          {menuItem('Delete', () => onDeleteRequest(contextMenu.node!))}
        </>
      )}
    </div>
  )

  // The tree stays mounted while a term matches nothing so clearing the term
  // restores the pre-filter expansion exactly (FR-008); the empty message
  // overlays the tree's (empty) list area.
  const renderTreeContent = () => {
    if (data.length === 0) {
      return <div className="tree-empty">No markdown files in this folder</div>
    }
    return (
      <div className="tree-body" ref={treeBodyRef}>
        <ArboristTree
          ref={(api) => {
            if (api) treeRef.current = api
          }}
          data={data}
          width={treeBodySize.width}
          height={Math.max(0, treeBodySize.height)}
          rowHeight={28}
          selection={selectedId ?? undefined}
          onSelect={handleSelect}
          onActivate={handleActivate}
          onToggle={handleToggle}
          onRename={handleRename}
          onMove={handleMove}
          disableMultiSelection={true}
          disableDrop={disableDrop}
          openByDefault={false}
          searchTerm={searchTerm}
          searchMatch={handleSearchMatch}
          renderRow={renderRow}
          aria-label="Workspace files"
        >
          {renderNode}
        </ArboristTree>
        {showNoMatchState && (
          <div className="tree-empty tree-empty-overlay" data-testid="explorer-search-empty">
            No files match “{searchTerm}”
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="tree-container"
      onContextMenu={handleContainerContextMenu}
    >
      <ExplorerSearchInput
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        onEscape={handleSearchEscape}
        inputRef={searchInputRef}
      />
      {renderTreeContent()}

      {createPortal(menu, document.body)}
    </div>
  )
}
