# Research: Caret Line Sync Between Editing Views

**Feature**: specs/052-caret-line-sync | **Date**: 2026-08-28

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives. Line references are against the tree at the time of writing.

## R1. The displayed source text is guaranteed to be the visual document's own serialization at switch time

**Decision**: Derive the block-to-line table from the text the source view is about to display, correlated with the visual document's top-level blocks by order.

**Evidence**: `handleShowSource` runs `flushLiveContent()` then `captureContentForSwitch(id)` before `SET_VIEW` (src/renderer/hooks/useSourceViewToggle.ts:36-45). The switch capture serialises the live editor: `planSwitchCapture` decides whether the editor output differs from the stored body (src/renderer/domain/dirty.ts:63-79), and `captureContentForSwitch` performs the `UPDATE_CONTENT` dispatch when it does (src/renderer/hooks/useDocumentSession.ts:107-122), identity-checking against the baseline doc to skip the cost when unchanged (src/renderer/state/documents.ts:265-297). The source view renders `joinFrontmatter(document.frontmatter, document.content)` (src/renderer/editor/EditorPanel.tsx:122-123), and frontmatter is carried separately from the body, so the body portion of the displayed text is exactly the editor's own serialisation. A stable prefix (the frontmatter length) shifts every mapping by a fixed offset, computed once per document.

**Consequence**: Structural correlation between the visual document's top-level blocks and the displayed text's top-level blocks is sound by construction, with one verifier and one fallback (R3).

## R2. One parse of the displayed text yields the whole block-to-line table

**Decision**: Parse the displayed source text with the same remark pipeline the app already uses; every top-level node carries position line/column ranges, so one O(n) pass produces the spans.

**Evidence**: The renderer already parses markdown through remark/micromark (package.json dependencies; the visual editor's ingest pipeline), and mdast nodes expose `position.start.line` and `position.end.line`. No new dependency is required. The table is a flat array of `{ startLine, endLine }` per top-level node plus the frontmatter's line span; a source line resolves to a block by binary search, a visual block index resolves to a line by table lookup.

**Alternatives rejected**:
- *Re-serialise block by block to count lines*: N serialisations per switch instead of one parse; no accuracy gain (the displayed text already exists).
- *DOM geometry (pixel fraction between the two surfaces)*: viewport- and theme-dependent, breaks at any zoom or font difference, and untestable without a mounted editor; the parse approach is pure and unit-testable.

## R3. Correlation must be verified, with a silent fallback

**Decision**: After computing the table, verify the parsed top-level child count equals the visual document's top-level child count. On mismatch (or any exception), skip the mapping for that switch and use today's stored-context behaviour.

**Evidence**: The app's round trip is not byte-exact for every construct: Crepe normalises some input (for example bare URLs become bracketed links; archived spec 002 FR-12 documents the class), and the tight-list fixes (src/renderer/editor/tightList.ts) exist precisely because serialisation had edge cases. The switch-time capture guarantees the *text* matches the *editor output* (R1), which makes child-count correlation reliable in practice; where it fails, the spec's FR-005 requires degradation, not error.

**Consequence**: Clamping chain for any failure: nearest block start, then body start, then today's behaviour. Mapping never throws out of the switch path.

## R4. "Untouched source caret" is detected by snapshot comparison, not event tracking

**Decision**: When the sync seeds the source caret, remember the seeded values (selection and scroll) on the document state. On return, if the live source context equals the snapshot and the source session made no edits, treat the caret as untouched and apply FR-003's exact restore; otherwise apply FR-004's mapped restore.

**Evidence**: The source view already reports every selection and scroll change upward through a coalesced context capture (src/renderer/editor/SourceView.tsx:63-76, 90-97) into `CAPTURE_SOURCE_CONTEXT` (src/renderer/state/documents.ts:392-410). Comparing the live values to the snapshot needs two new optional fields on `DocumentState` and no new listeners or plumbing; wiring a moved-flag through the editor's listener chain would add state transitions for information the comparison already yields.

**Alternatives rejected**:
- *Tracking a `moved` boolean from editor events*: redundant state that can desynchronise from the actual selection; the snapshot comparison cannot drift.
- *Always mapping on return*: rejected at the spec level (breaks the exact unedited round trip, archived spec 044 FR-004); the hybrid is the specified behaviour.

## R5. The mapped result flows through existing restore machinery

**Decision**: On return, the mapped visual caret offset is written into the document state (the same `cursorOffset`/`scrollTop` fields the return path already restores from), so `applyCursorRestore` (src/renderer/editor/cursorRestore.ts:35-54) applies it unchanged, including clamping to a valid text position. Entering source, the mapped line-start offsets are written into the existing `sourceSelectionAnchor`/`sourceSelectionHead` fields.

**Evidence**: Both switch directions already pass through actions that carry caret payloads (`CAPTURE_EDITOR_STATE`, `CAPTURE_SOURCE_CONTEXT`, `REFRESH_FROM_SOURCE` deliberately retaining stored offsets, src/renderer/state/documents.ts:504-527). The sync therefore adds no new actions and no reducer-shape break; it only changes which values those fields hold at the moment of the switch.

**Consequence**: The reveal-on-screen behaviour (scroll to caret) comes free: the editors already reveal a freshly applied caret. Two new optional snapshot fields are the only state change.

## R6. Cost is one linear parse per switch, off the keystroke path

**Decision**: No incremental or continuous mapping; the table is computed at switch time and discarded.

**Evidence**: The switch already serialises the document (R1), which is the same order of cost as the parse. The constitution's calm-editing gate concerns the keystroke path, which is untouched. For 10,000-line documents the added work is one extra linear pass over text the switch already handles, well inside the imperceptibility budget (SC-005).

**Alternatives rejected**:
- *Persistent block table updated on edits*: state to keep consistent across every edit path (visual, source, reload, external change) for zero user-visible gain, since the switch recomputes from fresh text anyway.
- *Character-exact position map*: explicitly out of scope per the spec's accuracy contract; roughly an order of magnitude more code for precision the user declined.
