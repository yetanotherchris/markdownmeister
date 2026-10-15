# Contract: File Explorer Toggle Icon

Renderer DOM contract for the header control that shows and hides the file explorer. Not an IPC contract.

## DOM shape

```text
div.header-bar
  └── div.chrome-bar
        ├── button[aria-label="Open menu"]
        └── button.chrome-icon-button[aria-label="Toggle file explorer"][title="Toggle file explorer"]
              └── svg.chrome-icon.lucide-panel-left
                    ├── rect[x="3"][y="3"][width="18"][height="18"][rx="2"]
                    └── path[d="M9 3v18"]
```

The button is disabled when no workspace is open. Its click handler remains `handleToggleExplorer`.

## Glyph geometry

The outline is the rectangle from (3, 3) to (21, 21). The only divider is the vertical path at x=9. The outline's horizontal center is x=12, so the divider is left of center. The left pane is 6 units wide and the right pane is 12 units wide. `rx` is greater than 0. The svg `fill` attribute is `none` and `stroke-width` is `1.5`.

## Invariants

- The button's class, dimensions, tooltip, accessible name, disabled rule, and activation stay as they are.
- The same svg is present when the explorer is visible, when it is collapsed, and when the button is disabled.
- Rendered button bounds match the menu button. Rendered glyph bounds match the menu glyph. Both sit on the same header row.
- Stroke color follows the button's `color` in light and dark, including the existing disabled opacity, and it differs from the header background.
- Hover and keyboard focus keep the existing `.chrome-icon-button` rules. The glyph does not change in those states.
- Hiding and restoring the explorer does not change the active document's text or dirty marker.
- No main, preload, or stylesheet file changes for this feature.

## Verification

`tests/e2e/explorer-toggle-icon.spec.ts` asserts the geometry, the unchanged name, both themes, alignment with the menu button, keyboard activation, the disabled state, and an unsaved document. `tests/e2e/chrome.spec.ts` and `tests/e2e/window-state.spec.ts` keep their existing toggle and disabled coverage.
