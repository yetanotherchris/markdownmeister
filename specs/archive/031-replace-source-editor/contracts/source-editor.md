# Source Editor UI Contract

## Surface

| Contract | Requirement |
|----------|-------------|
| Region | The source surface is a visible `role="region"` named `Markdown source` while its document is in source view. |
| Editable element | The CodeMirror content element is editable, has accessible name `Markdown source`, and retains `data-testid="source-textarea"` for existing source workflow locators. |
| Toolbar | The compact toolbar remains visible and includes the labeled `Back to visual editing` action. |
| Focus | Entering source view or activating a source-view tab focuses only that visible source surface. |
| Spellcheck | The editable content's native `spellcheck` attribute reflects the existing source-view spellcheck setting. |

## Data Flow

1. The surface receives the complete recombined raw document, including valid leading frontmatter, body, empty lines, and exact trailing-newline presence.
2. A document change emits the complete raw text through the existing document content callback.
3. Selection or scroll changes emit the document-local source context without changing document content or dirty state.
4. The surface restores saved source selection and vertical scroll when its document becomes active again.
5. Markdown and valid YAML frontmatter highlighting are decorations only. Invalid, incomplete, and unsupported syntax remains editable and unmodified.

## Non-Goals

The surface does not expose autocomplete, completion, find/replace, source commands, filesystem access, IPC operations, or language-specific highlighting inside fenced code.

## Acceptance Evidence

Electron e2e tests exercise Markdown/YAML decorations, raw editing and save, malformed input, tab-local selection and scroll restoration, focus, spellcheck, and unsaved-change confirmations.
