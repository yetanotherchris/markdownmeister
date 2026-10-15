# Data Model: File Explorer Toggle Icon

This feature adds no entity and no runtime state. The only object is the header control that already toggles the file explorer.

## Explorer toggle

| Field | Value | Notes |
|-------|-------|-------|
| Element | `button.chrome-icon-button` | Unchanged. Still the second control in `.chrome-bar`. |
| Accessible name | `Toggle file explorer` | `aria-label`. Unchanged (FR-005). |
| Tooltip | `Toggle file explorer` | `title`. Unchanged (FR-005). |
| Enabled | Workspace open (`workspace.name !== null`) | Unchanged (FR-006). |
| Activation | `sidebar.handleToggleExplorer` | Unchanged. Mouse click and keyboard activation of the button. |
| Glyph | `PanelLeft` | One rounded window outline and one vertical divider at x=9. Replaces `Squares2X2Icon` (FR-001, FR-002). |
| Glyph size | `.chrome-icon` (20 by 20) | Shared with the hamburger. No new rule (FR-003). |
| Stroke | `currentColor`, width 1.5 | Inherits the button colour, including disabled, hover, and focus (FR-004, FR-007). |
| Shown when | Visible, hidden, and unavailable | The same element. It is not swapped (FR-004). |

## Validation rules

- The svg contains one rectangle outline and one path, `M9 3v18`.
- The divider x (9) is left of the outline's horizontal centre, and the left pane is narrower than the right pane.
- The svg `fill` is `none`.
- The rendered button box and glyph box match the hamburger button and glyph.
- The accessible name and tooltip stay `Toggle file explorer`.
- Collapsing and restoring the explorer does not change a document's text or dirty marker.

## State transitions

None for the glyph. Explorer visibility continues to move through the existing sidebar panel and `explorerVisible` setting. This feature does not add a state.
