import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Bars3Icon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { MenuCommand, RecentItem } from '../../shared/ipc-contract'
import { hamburgerMenuStructure, recentMenuEntries } from './menuModel'
import type { Platform, HamburgerItem } from './menuModel'
import './chrome.css'

/** The sandboxed renderer exposes a minimal `process` with `platform`. */
function currentPlatform(): Platform {
  const p = (globalThis as { process?: { platform?: string } }).process?.platform
  return p === 'darwin' || p === 'linux' ? p : 'win32'
}

interface HamburgerMenuProps {
  /** The shared renderer command bus (handleMenuCommand from useMenuCommands). */
  onCommand: (command: MenuCommand) => void

  onOpenSettings: () => void
}


export default function HamburgerMenu({ onCommand, onOpenSettings }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)
  const [recentError, setRecentError] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const submenuOpenRef = useRef(false)
  const setSubmenuOpenSync = useCallback((value: boolean) => {
    submenuOpenRef.current = value
    setSubmenuOpen(value)
  }, [])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const recentParentRef = useRef<HTMLButtonElement>(null)
  const structure = hamburgerMenuStructure(currentPlatform())

  const loadRecent = useCallback(() => {
    setRecentLoaded(false)
    setRecentError(false)
    window.api.getRecentItems().then((result) => {
      if (result.ok) setRecentItems(result.value)
      else setRecentError(true)
      setRecentLoaded(true)
    })
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setSubmenuOpenSync(false)
    triggerRef.current?.focus()
  }, [setSubmenuOpenSync])

  const openRecentSubmenu = useCallback(() => {
    loadRecent()
    setSubmenuOpenSync(true)
  }, [loadRecent, setSubmenuOpenSync])

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false)
      setSubmenuOpenSync(false)
    } else {
      // The fetch lives OUTSIDE the state updater: React StrictMode double-
      // invokes updaters in dev, which would fire two IPC requests per open.
      loadRecent()
      setOpen(true)
    }
  }, [open, loadRecent, setSubmenuOpenSync])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSubmenuOpenSync(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, setSubmenuOpenSync])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submenuOpen) {
          setSubmenuOpenSync(false)
          recentParentRef.current?.focus()
          return
        }
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, submenuOpen])

  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus()
  }, [open])

  useEffect(() => {
    if (!open || !submenuOpen) return
    const first = submenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus()
  }, [open, submenuOpen])

  const handleSelect = useCallback((command: MenuCommand) => {
    onCommand(command)
    close()
  }, [close, onCommand])

  const handleAction = useCallback((action: 'clear-recent' | 'settings' | 'quit') => {
    if (action === 'clear-recent') {
      void window.api.clearRecentItems().then(() => loadRecent())
    } else if (action === 'settings') {
      onOpenSettings()
    } else {
      void window.api.requestQuit()
    }
    close()
  }, [close, loadRecent, onOpenSettings])

  const recentEntries = recentMenuEntries(recentItems)

  const renderItem = (item: HamburgerItem, index: number) => {
    switch (item.kind) {
      case 'command':
        return (
          <button
            key={`${index}-${item.command}`}
            role="menuitem"
            className="menu-item"
            onClick={() => handleSelect(item.command)}
          >
            <span className="menu-item-label">{item.label}</span>
            {item.accelerator && (
              <span className="menu-item-accelerator" aria-hidden="true">{item.accelerator}</span>
            )}
          </button>
        )
      case 'recent-items':
        return (
          <div key={`${index}-recent`} className="submenu-anchor">
            <button
              ref={recentParentRef}
              role="menuitem"
              className="menu-item"
              aria-haspopup="menu"
              aria-expanded={submenuOpen}
              onClick={() => {
                if (!submenuOpenRef.current) openRecentSubmenu()
              }}
              onMouseEnter={openRecentSubmenu}
            >
              <span className="menu-item-label">Recent Items</span>
              <ChevronRightIcon className="menu-item-chevron" aria-hidden="true" />
            </button>
            {submenuOpen && recentLoaded && (
              <div ref={submenuRef} className="hamburger-submenu" role="menu" aria-label="Recent Items">
                {recentEntries.length === 0 && !recentError ? (
                  <button role="menuitem" className="menu-item" disabled>
                    <span className="menu-item-label">No Recent Items</span>
                  </button>
                ) : (
                  <>
                    {recentEntries.map((entry, i) => {
                      const separatorBeforeFiles =
                        entry.item.kind === 'file' && i > 0 && recentEntries[i - 1].item.kind === 'folder'
                      return (
                        <Fragment key={`${entry.item.path}\u0000${entry.item.kind}`}>
                          {separatorBeforeFiles && <div role="separator" className="menu-separator" />}
                          <button
                            role="menuitem"
                            className="menu-item"
                            onClick={() =>
                              handleSelect({ type: 'open-recent', path: entry.item.path, kind: entry.item.kind })
                            }
                          >
                            <span className="menu-item-label">{entry.label}</span>
                          </button>
                        </Fragment>
                      )
                    })}
                    <div role="separator" className="menu-separator" />
                    <button role="menuitem" className="menu-item" onClick={() => handleAction('clear-recent')}>
                      <span className="menu-item-label">Clear Recent Items</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      case 'separator':
        return <div key={`${index}-sep`} role="separator" className="menu-separator" />
      case 'action':
        return (
          <button
            key={`${index}-${item.action}`}
            role="menuitem"
            className="menu-item"
            onClick={() => handleAction(item.action)}
          >
            <span className="menu-item-label">{item.label}</span>
          </button>
        )
    }
  }

  return (
    <div className="hamburger">
      <button
        ref={triggerRef}
        type="button"
        className="chrome-icon-button"
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        title="Menu"
      >
        <Bars3Icon className="chrome-icon" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} className="hamburger-menu" role="menu" aria-label="Application menu">
          {structure.map(renderItem)}
        </div>
      )}
    </div>
  )
}
