import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import { Panel, Group, Separator, usePanelRef } from 'react-resizable-panels'
import type { TreeApi } from 'react-arborist'
import { Squares2X2Icon } from '@heroicons/react/24/outline'
import {
  EditingSession,
  documentsReducer,
  getActiveDocument,
  DocumentState
} from './state/documents'
import { initialWorkspaceState, workspaceReducer, TreeNode } from './state/workspace'
import { getSettings } from './state/settings'
import { instancePool } from './editor/instancePool'
import { isDirtyLive as domainIsDirtyLive } from './domain/dirty'
import { useDialogQueue } from './hooks/useDialogQueue'
import { useEditorPool } from './hooks/useEditorPool'
import { useDocumentSession } from './hooks/useDocumentSession'
import { useSourceViewToggle } from './hooks/useSourceViewToggle'
import { useWorkspaceTree } from './hooks/useWorkspaceTree'
import { useExternalFileEvents } from './hooks/useExternalFileEvents'
import { useMenuCommands } from './hooks/useMenuCommands'
import { useOsOpen } from './hooks/useOsOpen'
import { useWorkspaceFolder } from './hooks/useWorkspaceFolder'
import { useSidebarLayout } from './hooks/useSidebarLayout'
import { useSettingsState } from './hooks/useSettingsState'
import EditorPanel, { type FindRequest } from './editor/EditorPanel'
import EditorErrorBoundary from './editor/EditorErrorBoundary'
import SpellingMenu from './editor/SpellingMenu'
import type { SpellingMenuState } from './editor/spellcheckPlugin'
import { updateSpellcheckRuntime, spellcheckRuntime } from './editor/spellcheckRuntime'
import Tree from './explorer/Tree'
import TabBar from './tabs/TabBar'
import StatusFooter from './status/StatusFooter'
import HamburgerMenu from './chrome/HamburgerMenu'
import SettingsDialog from './chrome/SettingsDialog'
import { isWorkspaceRelative } from './explorer/operations'
import './App.css'
import './chrome/chrome.css'
import './editor/editor.css'
import './editor/themes.css'
import { resolveEditorAppearance } from './state/editorThemes'
import { isSerifTypeface } from '../shared/editorThemeTokens'

const initialSession: EditingSession = {
  documents: [],
  activeId: null,
  untitledCounter: 0
}

export default function App() {
  const [session, dispatch] = useReducer(documentsReducer, initialSession)
  const [workspace, dispatchWorkspace] = useReducer(workspaceReducer, initialWorkspaceState)
  const handleCursorSyncApplied = useCallback(
    (id: string) => dispatch({ type: 'CLEAR_VISUAL_CARET', payload: { id } }),
    [dispatch]
  )
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [footerNote, setFooterNote] = useState<string | null>(null)
  const [spellMenu, setSpellMenu] = useState<SpellingMenuState | null>(null)
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [findRequest, setFindRequest] = useState<FindRequest | null>(null)
  const findSeqRef = useRef(0)
  const {
    settingsOpen,
    setSettingsOpen,
    editorTheme,
    handleEditorThemeChange,
    editorThemes,
    invalidThemeFileNames,
    refreshEditorThemes,
    spellcheckEnabled,
    handleSpellcheckChange,
    spellcheckLanguage,
    handleSpellcheckLanguageChange,
    fileOpenBehavior,
    handleFileOpenBehaviorChange,
    markdownOptions,
    handleMarkdownOptionChange,
    visualCodeHighlighting,
    handleVisualCodeHighlightingChange,
    formattingBarVisible,
    handleFormattingBarVisibleChange,
    wordWrap,
    handleWordWrapChange,
    themeChoice,
    handleThemeChange,
    themeMode
  } = useSettingsState()

  const resolvedAppearance = resolveEditorAppearance(editorTheme, themeMode, editorThemes)
  const dataEditorTheme = resolvedAppearance.definitionName ?? 'default'
  const fileThemeVars = {
    '--mm-theme-background': resolvedAppearance.palette.background,
    '--mm-theme-foreground': resolvedAppearance.palette.foreground,
    '--mm-theme-accent': resolvedAppearance.palette.accent,
    '--mm-theme-surface': resolvedAppearance.palette.surface,
    '--mm-theme-outline': resolvedAppearance.palette.outline,
    '--mm-theme-code': resolvedAppearance.palette.code,
    '--mm-theme-font': resolvedAppearance.typeface
  } as React.CSSProperties

  useEffect(() => {
    updateSpellcheckRuntime({ enabled: spellcheckEnabled, language: spellcheckLanguage })
  }, [spellcheckEnabled, spellcheckLanguage])
  useEffect(() => {
    let alive = true
    window.api
      .getSpellcheckWords()
      .then((res) => {
        if (res.ok && alive) {
          const merged = new Set(spellcheckRuntime.customWords)
          res.value.forEach((word) => merged.add(word))
          updateSpellcheckRuntime({ customWords: merged })
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const sidebarPanelRef = usePanelRef()
  // `defaultSize` is initialization-only. Reapplying a newly persisted width
  // during a resize makes react-resizable-panels discard its restore size.
  const sidebarInitialSizeRef = useRef(getSettings().sidebarWidth)
  const explorerRestoreDoneRef = useRef(false)
  const pendingCreateRef = useRef(new Set<string>())
  const createCounterRef = useRef(0)
  const treeApiRef = useRef<TreeApi<TreeNode> | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const activeDoc = getActiveDocument(session)

  const getMarkdown = useCallback((id: string) => instancePool.getMarkdown(id), [])
  const getLiveDoc = useCallback((id: string) => instancePool.getLiveDoc(id), [])
  const getBaselineDoc = useCallback((id: string) => instancePool.getBaselineDoc(id), [])
  const isDirtyLive = useCallback(
    (doc: DocumentState) => domainIsDirtyLive(doc, getMarkdown, getLiveDoc, getBaselineDoc),
    [getMarkdown, getLiveDoc, getBaselineDoc]
  )
  const dialog = useDialogQueue(sessionRef)
  const pool = useEditorPool({ dispatch, sessionRef, isDirtyLive })
  const sessionApi = useDocumentSession({
    dispatch,
    sessionRef,
    dialog,
    enforcePoolCap: pool.enforcePoolCap
  })
  const source = useSourceViewToggle({
    dispatch,
    sessionRef,
    session: sessionApi,
    enforcePoolCap: pool.enforcePoolCap
  })
  const tree = useWorkspaceTree({
    dispatch,
    dispatchWorkspace,
    sessionRef,
    workspaceRef,
    dialog,
    session: sessionApi,
    treeApiRef,
    pendingCreateRef,
    createCounterRef,
    setPendingEditId
  })
  const external = useExternalFileEvents({ sessionRef, dialog, session: sessionApi })
  const folder = useWorkspaceFolder({
    dispatchWorkspace,
    sessionRef,
    dialog,
    session: sessionApi,
    sidebarPanelRef
  })
  const sidebar = useSidebarLayout({
    sidebarPanelRef,
    explorerRestoreDoneRef,
    setExplorerCollapsed
  })
  const menu = useMenuCommands({
    sessionRef,
    dialog,
    session: sessionApi,
    folder,
    dispatch,
    enforcePoolCap: pool.enforcePoolCap,
    requestFind: useCallback((id: string) => {
      findSeqRef.current += 1
      setFindRequest({ id, seq: findSeqRef.current })
    }, [])
  })
  useOsOpen({ session: sessionApi, folder, onOpenFailed: setFooterNote })

  const { handleMenuCommand } = menu
  const { handleQuitRequest } = sessionApi
  const { handleExternalChange } = external

  const handleReveal = useCallback((node: TreeNode) => {
    window.api
      .revealEntry(node.id, node.kind)
      .then((res) => {
        setFooterNote(res.ok ? null : res.message)
      })
      .catch(() => {
        setFooterNote('Could not open the item in the file manager')
      })
  }, [])

  const handleOpenNewTab = useCallback(
    (node: TreeNode) => {
      window.api.readFile(node.id).then((result) => {
        if (result.ok) sessionApi.openFileFromExplorer(result.value, true)
      })
    },
    [sessionApi]
  )

  useEffect(() => {
    const unsubMenu = window.api.onMenuCommand(handleMenuCommand)

    const unsubDocument = window.api.onDocumentChanged((e) => {
      const doc = sessionRef.current.documents.find((d) => d.path === e.path)
      if (!doc) return
      dispatch({ type: 'EXTERNAL_CHANGE', payload: { path: e.path, kind: e.kind } })
      if (dialog.dialogInFlightRef.current) {
        const pending = dialog.pendingExternalPromptRef.current
        if (!pending.some((item) => item.path === e.path && item.kind === e.kind)) {
          pending.push({ path: e.path, kind: e.kind })
        }
        return
      }
      handleExternalChange(doc, e.kind)
    })

    const unsubWorkspace = window.api.onWorkspaceChanged((e) => {
      dispatchWorkspace({ type: 'APPLY_WATCH_EVENT', payload: e })
    })

    const unsubQuit = window.api.onQuitRequested(() => {
      void handleQuitRequest()
    })

    const unsubRecentWarning = window.api.onRecentItemsWarning((w) => {
      setFooterNote(w.message)
    })
    const unsubRecentOk = window.api.onRecentItemsOk(() => {
      setFooterNote(null)
    })

    return () => {
      unsubMenu()
      unsubDocument()
      unsubWorkspace()
      unsubRecentWarning()
      unsubRecentOk()
      unsubQuit()
    }
  }, [
    dispatch,
    dispatchWorkspace,
    dialog,
    handleExternalChange,
    handleMenuCommand,
    handleQuitRequest,
    sessionRef
  ])

  useEffect(() => {
    return () => {
      instancePool.destroyAll()
    }
  }, [])

  const workspaceActiveId = session.activeId
  useEffect(() => {
    if (!workspace.name) return
    const active = sessionRef.current.documents.find((d) => d.id === workspaceActiveId)
    const path = active?.path
    if (!path || !isWorkspaceRelative(path)) {
      dispatchWorkspace({ type: 'SELECT', payload: { id: null } })
      return
    }
    dispatchWorkspace({ type: 'SELECT', payload: { id: path } })
    const api = treeApiRef.current
    if (api) {
      api.openParents(path)
      api.scrollTo(path)
    }
  }, [
    workspaceActiveId,
    workspace.name,
    workspace.nodes,
    dispatchWorkspace,
    sessionRef,
    treeApiRef
  ])

  const hasWorkspace = workspace.name !== null

  return (
    <div
      className="app-container"
      data-editor-theme={dataEditorTheme}
      data-theme={themeMode}
      data-editor-serif={isSerifTypeface(resolvedAppearance.typeface) ? 'true' : 'false'}
      data-visual-code-highlighting={visualCodeHighlighting ? 'on' : 'off'}
      data-formatting-bar={formattingBarVisible ? 'on' : 'off'}
      style={fileThemeVars}
    >
      {}
      <div className="header-bar">
        <div className="chrome-bar">
          <HamburgerMenu
            onCommand={handleMenuCommand}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <button
            type="button"
            className="chrome-icon-button"
            aria-label="Toggle file explorer"
            title="Toggle file explorer"
            onClick={sidebar.handleToggleExplorer}
            disabled={!hasWorkspace}
          >
            <Squares2X2Icon className="chrome-icon" aria-hidden="true" />
          </button>
        </div>
        <TabBar
          documents={session.documents}
          activeId={session.activeId}
          onActivate={sessionApi.handleActivate}
          onClose={sessionApi.handleCloseRequest}
          onNew={sessionApi.handleNew}
        />
      </div>
      <div className="main-area">
        <Group orientation="horizontal" className="panel-group">
          {hasWorkspace && (
            <>
              <Panel
                defaultSize={String(sidebarInitialSizeRef.current)}
                minSize="15"
                maxSize="50"
                className="sidebar-panel"
                collapsible
                collapsedSize={0}
                panelRef={sidebarPanelRef}
                onResize={sidebar.handleSidebarResize}
              >
                <div className="sidebar">
                  <Tree
                    data={workspace.nodes}
                    selectedId={workspace.selectedId}
                    onSelect={tree.handleTreeSelect}
                    onActivate={tree.handleTreeActivate}
                    onFileOpen={tree.handleFileOpen}
                    onToggle={tree.handleTreeToggle}
                    pendingEditId={pendingEditId}
                    onRename={tree.handleRename}
                    onEditingCancelled={tree.handleEditingCancelled}
                    onDeleteRequest={tree.runDeleteConfirmation}
                    onCreateRequest={tree.handleCreate}
                    onMove={tree.handleTreeMove}
                    onOpen={source.handleOpen}
                    onViewSource={source.handleViewSource}
                    onReveal={handleReveal}
                    onOpenNewTab={handleOpenNewTab}
                    apiRef={treeApiRef}
                  />
                </div>
              </Panel>
              <Separator
                className="resize-handle"
                style={explorerCollapsed ? { visibility: 'hidden' } : undefined}
              />
            </>
          )}
          <Panel className="editor-panel">
            <div className="editor-area">
              {session.documents.length === 0 ? (
                <div className="empty-state">
                  <p>Open a file or create a new document to get started.</p>
                </div>
              ) : (
                session.documents.map((doc) => (
                  <EditorErrorBoundary
                    key={doc.panelId}
                    title={doc.title}
                    onReload={() => void sessionApi.reloadDocument(doc)}
                  >
                    <EditorPanel
                      document={doc}
                      isActive={doc.id === session.activeId}
                      markdownOptions={markdownOptions}
                      spellcheckEnabled={spellcheckEnabled}
                      wordWrap={wordWrap}
                      onWordWrapChange={handleWordWrapChange}
                      onSpellingMenu={setSpellMenu}
                      onContentChange={sessionApi.handleContentChange}
                      onBaselineCapture={sessionApi.handleBaselineCapture}
                      onStagedEditorReady={sessionApi.handleStagedEditorReady}
                      onCursorState={sessionApi.handleCursorState}
                      onSourceContext={sessionApi.handleSourceContext}
                      onCursorSyncApplied={handleCursorSyncApplied}
                      onRequestViewSource={source.handleShowSource}
                      onReturnToFormatted={source.handleReturnToFormatted}
                      findRequest={findRequest}
                    />
                  </EditorErrorBoundary>
                ))
              )}
            </div>
          </Panel>
        </Group>
      </div>

      <StatusFooter activeDoc={activeDoc} workspaceRoot={workspace.root} note={footerNote} />

      {settingsOpen && (
        <SettingsDialog
          theme={themeChoice}
          onThemeChange={handleThemeChange}
          editorThemes={editorThemes}
          invalidThemeFileNames={invalidThemeFileNames}
          editorTheme={editorTheme}
          onRefreshEditorThemes={refreshEditorThemes}
          onEditorThemeSave={handleEditorThemeChange}
          spellcheckEnabled={spellcheckEnabled}
          onSpellcheckChange={handleSpellcheckChange}
          spellcheckLanguage={spellcheckLanguage}
          onSpellcheckLanguageChange={handleSpellcheckLanguageChange}
          fileOpenBehavior={fileOpenBehavior}
          onFileOpenBehaviorChange={handleFileOpenBehaviorChange}
          markdownOptions={markdownOptions}
          onMarkdownOptionChange={handleMarkdownOptionChange}
          visualCodeHighlighting={visualCodeHighlighting}
          onVisualCodeHighlightingChange={handleVisualCodeHighlightingChange}
          formattingBarVisible={formattingBarVisible}
          onFormattingBarVisibleChange={handleFormattingBarVisibleChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {spellMenu && <SpellingMenu menu={spellMenu} onDismiss={() => setSpellMenu(null)} />}
    </div>
  )
}
