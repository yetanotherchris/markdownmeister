import { useCallback, useRef } from 'react'
import { updateSettings } from '../state/settings'

export interface SidebarLayoutApi {
  handleSidebarResize: (size: { asPercentage: number; inPixels: number }) => void
  handleToggleExplorer: () => void
}

interface SidebarPanelLike {
  isCollapsed(): boolean
  expand(): void
  collapse(): void
}


export function useSidebarLayout(opts: {
  sidebarPanelRef: { current: SidebarPanelLike | null }
  explorerRestoreDoneRef: React.MutableRefObject<boolean>
  setExplorerCollapsed: (collapsed: boolean) => void
}): SidebarLayoutApi {
  const { sidebarPanelRef, explorerRestoreDoneRef, setExplorerCollapsed } = opts
  const expandingRef = useRef(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSidebarResize = useCallback(
    (size: { asPercentage: number; inPixels: number }) => {
      const collapsed = size.asPercentage <= 0
      if (collapsed && expandingRef.current) return
      if (!collapsed) {
        if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
        expandTimerRef.current = setTimeout(() => {
          expandingRef.current = false
          expandTimerRef.current = null
        }, 1000)
      }
      setExplorerCollapsed(collapsed)
      if (collapsed) {
        if (explorerRestoreDoneRef.current) {
          updateSettings({ explorerVisible: false })
          window.api.updateSettings({ explorerVisible: false }).catch(() => {
            /* ignore */
          })
        }
        return
      }
      updateSettings({ sidebarWidth: size.asPercentage })
      window.api.updateSettings({ sidebarWidth: size.asPercentage }).catch(() => {
        /* ignore */
      })
      updateSettings({ explorerVisible: true })
      window.api.updateSettings({ explorerVisible: true }).catch(() => {
        /* ignore */
      })
    },
    [expandTimerRef, explorerRestoreDoneRef, expandingRef, setExplorerCollapsed]
  )

  const handleToggleExplorer = useCallback(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return
    explorerRestoreDoneRef.current = true
    // isCollapsed() is true when the panel IS collapsed: expand then, else
    // collapse, and persist the resulting state.
    const currentlyCollapsed = panel.isCollapsed()
    if (currentlyCollapsed) {
      expandingRef.current = true
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
      panel.expand()
    } else {
      panel.collapse()
    }
    updateSettings({ explorerVisible: !currentlyCollapsed })
    window.api.updateSettings({ explorerVisible: !currentlyCollapsed }).catch(() => {
      /* ignore */
    })
  }, [expandTimerRef, expandingRef, explorerRestoreDoneRef, sidebarPanelRef])

  return { handleSidebarResize, handleToggleExplorer }
}
