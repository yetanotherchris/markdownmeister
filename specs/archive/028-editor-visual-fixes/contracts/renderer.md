# Contracts: Editor Visual Fixes — renderer

Renderer visual contracts for `028-editor-visual-fixes`. No new IPC operations and
no settings changes (Principles I & II). The contracts are enforced by the e2e
suite (`tests/e2e/editor-visual-fixes.spec.ts`) and the updated spec-014 suite
(`tests/e2e/view-source-icon.spec.ts`).

## Canvas fill contract (FR-001/002/003)

1. With a document open, `.milkdown` fills the editor host vertically: its height
   is at least the height of `.editor-host` for a short document (the canvas
   colour reaches the bottom of the editor region).
2. The canvas colour (the computed `background-color` of `.milkdown`) equals the
   active theme's canvas value, and no region of the editor area below/behind the
   content renders a different colour.
3. The rule holds for every editor theme, the custom theme, and both light and
   dark modes, and after a theme change (no residual patch).
4. For a long document, scrolling keeps the canvas colour behind the content with
   no other colour at the edges.

## View-source glyph contract (FR-004/005/006)

1. **Top bar**: the last `.top-bar-item` inside the Crepe top bar shows the
   code-bracket-square glyph (its `svg path` carries the heroicons 24px outline
   `d`). Its `title`/`aria-label` stay "View source" (label pipeline unchanged).
2. **Colour**: the glyph's computed colour equals the `--mm-view-source` token
   (`#2563eb`), in both light and dark modes, and differs from the accent token.
3. **Explorer context menu**: the "View source" `menuitem` shows the same
   code-bracket-square glyph in the same colour.

## E2e contract (`tests/e2e/editor-visual-fixes.spec.ts`)

1. **US1 short document** — open a one-line document in Rustic (default): the
   `.milkdown` bounding height ≥ `.editor-host` height, and a probe at the bottom
   of the editor area resolves to the Rustic canvas colour.
2. **US1 theme change** — switch Rustic → Scholarly via settings Save: the
   full-height canvas re-paints white with no residual patch.
3. **US1 long document scroll** — open a long document, scroll the editor host to
   the bottom: the canvas colour still fills the region, no other colour at the
   edges.
4. **US1 dark mode** — with the app theme Dark and a dark-capable theme
   (Monotone): the full-height canvas shows the theme's dark canvas colour.
5. **US1 custom theme** — a config carrying custom colours renders the custom
   canvas colour full-height (per spec 023 fixture pattern).
6. **US1 zero/single-character documents** — empty and single-character documents
   still fill the editor with the canvas colour (spec Edge Cases).
7. **US1 all five presets** — each preset theme (Rustic, Rustic Serif, Scholarly,
   Monotone, Monotone Serif) fills the editor with its own canvas colour
   (SC-001).
8. **US2 top bar** — the view-source button glyph is code-bracket-square; its
   computed colour equals the `--mm-view-source` token and differs from the accent
   in both light and dark mode.
9. **US2 context menu** — right-click a file in the explorer: the "View source"
   menuitem shows the code-bracket-square glyph in the dark-blue token colour.

## Updated spec-014 suite (`tests/e2e/view-source-icon.spec.ts`)

The 014 assertions that the icon is accent-coloured are replaced with
dark-blue-token assertions (028 supersedes 014's colour, decision log D4). The
structural checks (last top-bar item, tooltip/aria-label, distinctness from the
muted Bold icon, dark-mode coverage) are kept.
