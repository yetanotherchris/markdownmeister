# Visual Code Highlighting UI Contract

## Setting

| Contract | Requirement |
|----------|-------------|
| Location | A Markdown settings control is labeled `Syntax highlight code blocks`. |
| Value | `visualCodeHighlighting` is a persisted boolean, defaulting to enabled. |
| Scope | Applies only to fenced code blocks in the visual editor. |
| Enabled | Visual-editor code tokens use configured syntax colors. |
| Disabled | Visual-editor code text remains readable and editable with neutral inherited styling. |

## Invariants

Toggling the setting must not dispatch a document edit or reconfigure/recreate visual editor instances. It does not change code text, Markdown source, language labels, source-view highlighting, selection, scroll position, undo history, dirty state, or save behavior.

## Persistence

The setting uses the existing typed settings patch operation and existing main-process validation and atomic configuration persistence. No new IPC or preload contract is introduced.

## Acceptance Evidence

Electron e2e tests demonstrate default-on rendering, enable/disable repainting, preserved text/selection/undo/dirty state, source-view immunity, and restart persistence.
