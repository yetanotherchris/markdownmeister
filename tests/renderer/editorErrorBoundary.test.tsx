import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { Component } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import EditorErrorBoundary from '../../src/renderer/editor/EditorErrorBoundary'

class Bomb extends Component<{ explode: boolean }> {
  render() {
    if (this.props.explode) throw new Error('simulated editor crash')
    return <p>editor content</p>
  }
}

function Harness(props: { explode: boolean; onReload: () => void }) {
  return (
    <EditorErrorBoundary title="a.md" onReload={props.onReload}>
      <Bomb explode={props.explode} />
    </EditorErrorBoundary>
  )
}

let root: Root | null = null
const container = document.createElement('div')

beforeEach(() => {
  document.body.appendChild(container)
})

afterEach(() => {
  vi.restoreAllMocks()
  act(() => root?.unmount())
  root = null
  container.remove()
})

async function mount(element: React.ReactElement): Promise<void> {
  root = createRoot(container)
  await act(async () => root!.render(element))
}

describe('EditorErrorBoundary', () => {
  it('renders children unchanged when nothing throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await mount(<Harness explode={false} onReload={() => {}} />)

    expect(container.querySelector('.editor-error')).toBeNull()
    expect(container.textContent).toContain('editor content')
  })

  it('shows the quiet fallback with the kept-content message when the child throws', async () => {
    // React logs the caught error itself; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await mount(<Harness explode={false} onReload={() => {}} />)
    await act(async () => root!.render(<Harness explode onReload={() => {}} />))

    const fallback = container.querySelector('.editor-error')
    expect(fallback).not.toBeNull()
    expect(fallback!.getAttribute('role')).toBe('alert')
    expect(container.textContent).toContain('ran into a problem in a.md')
    expect(container.textContent).toContain('Your content is kept in the tab.')
  })

  it('Reload calls the recovery callback and brings the child back once it stops throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    await mount(<Harness explode={false} onReload={onReload} />)
    await act(async () => root!.render(<Harness explode onReload={onReload} />))
    expect(container.querySelector('.editor-error')).not.toBeNull()

    const reloadButton = container.querySelector<HTMLButtonElement>('button')!
    await act(async () => {
      reloadButton.click()
    })
    expect(onReload).toHaveBeenCalledTimes(1)
    // The bomb still explodes, so the boundary catches again instead of
    // blanking the panel.
    expect(container.querySelector('.editor-error')).not.toBeNull()

    // Recovery in the app clears the fault first (reloadDocument re-reads the
    // stored bytes); a second Reload then restores the child subtree.
    await act(async () => root!.render(<Harness explode={false} onReload={onReload} />))
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')!.click()
    })
    expect(onReload).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.editor-error')).toBeNull()
    expect(container.textContent).toContain('editor content')
  })
})
