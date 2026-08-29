# Research: View-Switching Caret Sync and Word Wrap Toggle Fixes

**Feature**: specs/053-view-sync-fixes | **Date**: 2026-08-29

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives. Line references are against the tree at the time of writing.

## R1. Milkdown keeps a trailing empty paragraph after a non-paragraph last block, breaking spec 052's count correlation

**Decision**: Report whether the visual document's last top-level child is an empty paragraph, and drop that one child when correlating block counts.

**Evidence**: Spec 052 correlates by requiring the parsed text's top-level block count to equal the visual document's top-level child count (`planSourceSeed` at src/renderer/domain/caretSync.ts:92-112, `table.blocks.length !== childSizes.length` → null). A diagnostic run against the built app compared the live ProseMirror child count (read from `doc.forEach`) with a remark-parse of the same displayed text:

| Document | ProseMirror children | remark blocks | Correlates? |
|----------|---------------------|---------------|-------------|
| `# Title` + 2 paragraphs | 3 | 3 | yes |
| flat 3-item list | 2 (list + empty `<p>`) | 1 | no |
| nested list | 2 (list + empty `<p>`) | 1 | no |
| task list | 2 (list + empty `<p>`) | 1 | no |
| table only | 2 (table + empty `<p>`) | 1 | no |
| para + code block | 3 (para, code, empty `<p>`) | 2 | no |
| para + table | 3 (para, table, empty `<p>`) | 2 | no |
| para + blockquote | 3 (para, quote, empty `<p>`) | 2 | no |

The trailing child is always an empty `<p>` (checked via `textContent.trim() === ''` and tag). Documents ending in a paragraph or heading correlate exactly, so the artifact appears specifically when the last block is a list, table, code block, or quote, i.e. a block that cannot host the caret at its end. The failure is silent: `planSourceSeed` returns null and the switch uses the stored source context, which for a fresh tab is the top of the document. The 052 e2e suite passes because its fixtures all end in a paragraph (`buildLongDoc` ends with section 24's paragraph).

**Consequence**: The fix must know, at switch time, whether the visual document carries this artifact. The signal belongs in `instancePool.getSelectionGeometry`, which already reads the live doc's children (`src/renderer/editor/instancePool.ts:64-76`).

## R2. Entering source: drop the trailing empty paragraph before correlating

**Decision**: In `planSourceSeed`, when the caller reports a trailing empty paragraph and the child count is exactly one more than the parsed block count, correlate against the child sizes without the last entry. A caret inside the dropped paragraph maps to the last real block.

**Evidence**: The parsed block table and the ProseMirror children correspond by index (spec 052 R1/R3). Dropping the artifact child makes `childSizes.length === table.blocks.length`. `topLevelBlockIndex` (caretSync.ts:75-85) resolves a caret at or past the end of the effective sizes to the last index, so a caret inside the trailing paragraph lands on the last real block (the list, table, code, or quote), which is the desired clamp. The drop only happens when `childSizes.length === table.blocks.length + 1` AND the caller reports the trailing artifact, so a genuinely empty trailing paragraph that the parser also produces (equal counts) still correlates normally.

**Alternatives rejected**:

- _Always drop the last child on any +1 mismatch_: unsafe; would mis-map when the +1 is a real block the parser simply does not produce. The structural signal (the artifact is an empty paragraph) is the guard.
- _Re-serialise the visual document and compare structurally_: an extra full serialisation per switch for a fact the geometry read already provides.

## R3. Returning to visual: the restore count check must accept the trailing empty paragraph

**Decision**: Widen `planBlockRestore` (src/renderer/editor/cursorRestore.ts:17-27) so it accepts a document whose child count is `blockCount + 1` when the extra trailing child is an empty paragraph. The `blockCount` the return path carries is the parsed text's block count (spec 052), so for these documents the freshly parsed visual document has one more child.

**Evidence**: On the return path, `planReturnRestore` → `planVisualRestore` returns `{ blockIndex, blockCount }` with `blockCount = table.blocks.length` (caretSync.ts:119-143). The prime rides to the visual editor as `cursorSync` and `planBlockRestore` refuses unless `doc.childCount === blockCount` (cursorRestore.ts:23). For a document ending in a list, the refreshed visual document has `blockCount + 1` children, so the mapped restore is refused today and the stored-offset restore applies instead. Accepting exactly one extra trailing empty paragraph restores the mapped caret; the blockIndex range `[0, blockCount)` never reaches the artifact child, so the caret lands in a real block.

**Edge verified**: If the source edit removes the trailing list, the refreshed document has `blockCount` children (no artifact) and the exact match still applies; if the edit adds a trailing list, the +1-with-artifact case applies. Both are covered by the same widened check.

## R4. The artifact is detected by node type and size, not by text content

**Decision**: The signal is `last child's type.name === 'paragraph' && last child's nodeSize === 2`. An empty paragraph in ProseMirror has `nodeSize === 2` (two boundary tokens, zero content), and Milkdown's artifact is always a paragraph.

**Evidence**: ProseMirror node size is `2 + content.size` for non-leaf nodes, so an empty paragraph is exactly 2. The type check excludes other size-2 possibilities and ties the signal to the documented behavior (R1). This mirrors how the restore side detects the artifact without needing the DOM (`planBlockRestore` receives the ProseMirror node directly).

## R5. The Word Wrap toggle grey off-state is a CSS-only change

**Decision**: Change the off-state background of `.source-word-wrap` from the plain background to the neutral grey surface, keeping the accent pressed state.

**Evidence**: The toggle currently shares `.source-return, .source-word-wrap { background: var(--mm-bg) }` and turns accent when pressed (`[aria-pressed='true']`, src/renderer/editor/editor.css:185-212). The source toolbar background is `var(--mm-surface-secondary)`. Making the off state `var(--mm-surface-secondary)` renders the toggle in the app's neutral grey in both themes (light `#f8f8fa`, dark `#181818`), matching the user's chosen behaviour ("grey when off, accent when on"). The pressed rule and `aria-pressed` reporting are untouched, so FR-006 (operation, keyboard access, state, persistence) and the existing word-wrap e2e suite hold.

**Alternatives rejected**:

- _Remove the accent pressed state entirely_: rejected by the user's chosen option ("accent when on").
- _A new dedicated grey variable_: unnecessary; the established surface variable is the documented grey tone in both themes.