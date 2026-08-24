import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useSettingsState } from '../../src/renderer/hooks/useSettingsState'
import { getSettings, updateSettings } from '../../src/renderer/state/settings'
import type { SpellcheckLanguage, FileOpenBehavior } from '../../src/shared/ipc-contract'
import type { ThemeChoice } from '../../src/renderer/hooks/useEffectiveTheme'

/**
 * Spec 016/036: `useSettingsState` seeds `editorTheme` (a theme-file name)
 * from the persisted cache and `handleEditorThemeChange` persists the committed
 * name, nothing else, since colours/typeface come from the theme file. The
 * hook's IPC calls are stubbed via `window.api` (the preload surface is out of
 * scope for unit tests, the e2e suite covers the real IPC).
 */

// Minimal stub of the DesktopApi call the hook makes. The preload surface
// types `window.api` globally (src/renderer/types.d.ts); tests replace it.
interface StubPatch {
  editorTheme?: string
  spellcheckEnabled?: boolean
  spellcheckLanguage?: SpellcheckLanguage | null
  fileOpenBehavior?: FileOpenBehavior
  hardBreaks?: boolean
  strikethrough?: boolean
  tables?: boolean
  taskLists?: boolean
  math?: boolean
  autolink?: boolean
}
function stubApi(): void {
  const calls: StubPatch[] = []
  ;(globalThis as unknown as { __apiCalls: StubPatch[] }).__apiCalls = calls
  window.api = {
    updateSettings: (patch: StubPatch) => {
      calls.push(patch)
      return Promise.resolve({ ok: true, value: getSettings() as never })
    }
  } as unknown as typeof window.api
}

// jsdom has no matchMedia; `useEffectiveTheme` reads it (spec 013). A no-op
// stub returning `matches: false` (light) is enough for the hook tests.
window.matchMedia =
  window.matchMedia ??
  ((() => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia)

let root: Root | null = null

function renderHook(): { read: () => ReturnType<typeof useSettingsState> } {
  let current: ReturnType<typeof useSettingsState> | null = null
  function Harness() {
    current = useSettingsState()
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => {
    root!.render(<Harness />)
  })
  return {
    read: () => {
      if (!current) throw new Error('hook did not render')
      return current
    }
  }
}

beforeEach(() => {
  updateSettings({ editorTheme: 'rustic' })
  stubApi()
})

describe('useSettingsState (spec 016)', () => {
  it('exposes the persisted editorTheme as the committed value', () => {
    updateSettings({ editorTheme: 'monotone-serif' })
    const { read } = renderHook()
    expect(read().editorTheme).toBe('monotone-serif')
  })

  it('handleEditorThemeChange updates local state, the cache, and the IPC with the name only', () => {
    const { read } = renderHook()
    act(() => {
      read().handleEditorThemeChange('scholarly')
    })
    expect(read().editorTheme).toBe('scholarly')
    expect(getSettings().editorTheme).toBe('scholarly')
    // Spec 036 FR-008: colours and typeface come from the theme FILE, the
    // handler persists nothing besides the name (no editorColors/editorFont).
    const calls = (globalThis as unknown as { __apiCalls: StubPatch[] }).__apiCalls
    expect(calls).toEqual([{ editorTheme: 'scholarly' }])
  })

  it('handleEditorThemeChange accepts any well-formed theme-file stem', () => {
    const { read } = renderHook()
    act(() => {
      read().handleEditorThemeChange('my-midnight_v2')
    })
    expect(read().editorTheme).toBe('my-midnight_v2')
    expect(getSettings().editorTheme).toBe('my-midnight_v2')
  })

  it('exposes the persisted spellcheckEnabled as the committed value', () => {
    updateSettings({ spellcheckEnabled: false })
    const { read } = renderHook()
    expect(read().spellcheckEnabled).toBe(false)
  })

  it('handleSpellcheckChange updates local state, the cache, and the IPC', () => {
    const { read } = renderHook()
    act(() => {
      read().handleSpellcheckChange(false)
    })
    expect(read().spellcheckEnabled).toBe(false)
    expect(getSettings().spellcheckEnabled).toBe(false)
    const calls = (globalThis as unknown as { __apiCalls: { spellcheckEnabled?: boolean }[] })
      .__apiCalls
    expect(calls).toEqual([{ spellcheckEnabled: false }])
  })

  it('seeds the spellcheck default from a fresh cache', () => {
    updateSettings({ spellcheckEnabled: true })
    const { read } = renderHook()
    expect(read().spellcheckEnabled).toBe(true)
  })

  it('exposes the persisted spellcheckLanguage (null = system default)', () => {
    updateSettings({ spellcheckLanguage: 'en-GB' })
    const { read } = renderHook()
    expect(read().spellcheckLanguage).toBe('en-GB')
  })

  it('handleSpellcheckLanguageChange updates local state, the cache, and the IPC', () => {
    const { read } = renderHook()
    act(() => {
      read().handleSpellcheckLanguageChange('en-US')
    })
    expect(read().spellcheckLanguage).toBe('en-US')
    expect(getSettings().spellcheckLanguage).toBe('en-US')
    const calls = (
      globalThis as unknown as { __apiCalls: { spellcheckLanguage?: SpellcheckLanguage | null }[] }
    ).__apiCalls
    expect(calls).toEqual([{ spellcheckLanguage: 'en-US' }])
  })

  it('still exposes the app-theme choice plumbing (spec 013)', () => {
    updateSettings({ themeOverride: 'dark' })
    const { read } = renderHook()
    expect(read().themeChoice).toBe('dark')
    act(() => {
      read().handleThemeChange('light')
    })
    expect(read().themeChoice).toBe('light')
    expect(read().themeMode).toBe('light')
  })

  it('seeds the editor theme default from a fresh cache', () => {
    updateSettings({ editorTheme: 'rustic' })
    const { read } = renderHook()
    expect(read().editorTheme).toBe('rustic')
  })

  it('exposes the persisted fileOpenBehavior as the committed value', () => {
    updateSettings({ fileOpenBehavior: 'new-tab' })
    const { read } = renderHook()
    expect(read().fileOpenBehavior).toBe('new-tab')
  })

  it('handleFileOpenBehaviorChange updates local state, the cache, and the IPC', () => {
    const { read } = renderHook()
    act(() => {
      read().handleFileOpenBehaviorChange('new-tab')
    })
    expect(read().fileOpenBehavior).toBe('new-tab')
    expect(getSettings().fileOpenBehavior).toBe('new-tab')
    const calls = (
      globalThis as unknown as { __apiCalls: { fileOpenBehavior?: FileOpenBehavior }[] }
    ).__apiCalls
    expect(calls).toEqual([{ fileOpenBehavior: 'new-tab' }])
  })

  it('does not expose a developer-tools control (removed in spec 008 clarification 2026-08-08)', () => {
    const { read } = renderHook()
    expect('developerToolsEnabled' in read()).toBe(false)
    expect('handleDeveloperToolsEnabledChange' in read()).toBe(false)
  })

  it('seeds the six markdown options from the cache with FR-013 defaults', () => {
    updateSettings({
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true
    })
    const { read } = renderHook()
    expect(read().markdownOptions).toEqual({
      hardBreaks: false,
      strikethrough: true,
      tables: true,
      taskLists: true,
      math: true,
      autolink: true
    })
  })

  it('handleMarkdownOptionChange updates local state, the cache, and the IPC', () => {
    const { read } = renderHook()
    act(() => {
      read().handleMarkdownOptionChange({ strikethrough: false })
    })
    expect(read().markdownOptions.strikethrough).toBe(false)
    expect(getSettings().strikethrough).toBe(false)
    const calls = (globalThis as unknown as { __apiCalls: { strikethrough?: boolean }[] })
      .__apiCalls
    // The handler persists all six fields, not just the patch.
    expect(calls).toEqual([
      {
        hardBreaks: false,
        strikethrough: false,
        tables: true,
        taskLists: true,
        math: true,
        autolink: true
      }
    ])
  })
})

// Type-only reference so the ThemeChoice import is not flagged unused.
export type { ThemeChoice }
