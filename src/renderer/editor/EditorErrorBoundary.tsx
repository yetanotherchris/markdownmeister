import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface EditorErrorBoundaryProps {
  title: string
  onReload: () => void
  children: ReactNode
}

interface EditorErrorBoundaryState {
  failed: boolean
}

/** Last-resort guard around one document's editor subtree (spec 044 D4). A
 *  failure during a view switch must leave a usable surface and a quiet,
 *  actionable message instead of blanking or hanging the window. */
export default class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): EditorErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Visual editor error in ${this.props.title}`, error, info.componentStack)
  }

  handleReload = (): void => {
    this.props.onReload()
    this.setState({ failed: false })
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="editor-error" role="alert">
        <p>
          The visual editor ran into a problem in {this.props.title}. Your content is kept in the
          tab.
        </p>
        <button type="button" onClick={this.handleReload}>
          Reload editor
        </button>
      </div>
    )
  }
}
