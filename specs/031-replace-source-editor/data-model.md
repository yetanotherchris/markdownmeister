# Data Model: Replace Source Editor

## Source Document

The existing `DocumentState` remains the authoritative in-memory representation of an open file.

| Field | Type | Rules |
|-------|------|-------|
| `baseline` | string | Complete raw text last read or saved. Source dirty state compares full raw source against this exact value. |
| `frontmatter` | string | Leading valid YAML frontmatter, including delimiters; empty when absent or invalid. |
| `content` | string | Markdown body after `frontmatter`; recombines with it for source display and save. |
| `view` | `'formatted' \| 'source'` | Identifies the active editing presentation for this document. |
| `sourceSelectionAnchor` | number | New. Primary source selection anchor, clamped to the current raw source length when restored. Defaults to `0`. |
| `sourceSelectionHead` | number | New. Primary source selection head, clamped to the current raw source length when restored. Defaults to `0`. |
| `sourceScrollTop` | number | New. Source editor vertical scroll offset in pixels. Defaults to `0`; non-negative. |
| `cursorOffset` / `scrollTop` | number | Existing formatted-editor context. These remain independent from source context. |

### Source Context Transitions

| Trigger | State change |
|---------|--------------|
| Open/new/reload document | Initialize source selection and scroll to zero. |
| CodeMirror selection or scroll update | Capture the document's source anchor, head, and scroll offset without modifying content or dirty state. |
| Source tab deactivation | Capture source context before the surface becomes inactive. |
| Source tab reactivation | Restore that document's source context and focus only its visible source surface. |
| Source text edit | Preserve/update raw `frontmatter` and `content` through the existing full-source update; dirty is exact raw text versus `baseline`. |
| Return to formatted view | Existing formatted remount behavior applies. Source context remains retained but does not overwrite formatted context. |
| Close document | Remove source context with the document after existing dirty confirmation succeeds. |

## YAML Frontmatter

| Field | Description | Validation |
|-------|-------------|------------|
| Delimited leading block | A YAML block at the beginning of the raw document, delimited by valid frontmatter markers. | Only a valid document-leading block is stored as `frontmatter`; similar or incomplete text remains ordinary source content. |
| Highlighting | Presentational CodeMirror language classification. | Never rewrites, validates, repairs, or rejects the raw text while typing. |

## Settings

The existing persisted `Settings` record gains one field.

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `visualCodeHighlighting` | boolean | `true` | Main process accepts only booleans from the settings operation. Missing, malformed, or legacy on-disk values resolve to `true`. |

### Settings Transitions

| Trigger | State change |
|---------|--------------|
| First run | Effective setting is `true`. |
| Writer toggles Markdown control | Renderer cache updates immediately; existing typed settings patch persists through the main process. |
| Application restart | Loaded valid persisted value becomes effective. |
| Toggle changes | Root presentation attribute updates; scoped visual-editor token CSS changes paint only. No document, selection, scroll, undo, language label, or dirty transition occurs. |
