# Feature Specification: View-Switching Caret Sync and Word Wrap Toggle Fixes

**Feature Branch**: `spec-053-view-sync-fixes`

**Created**: 2026-08-29

**Status**: Active

**Input**: User description: "The previous spec implementation didn't seem to implement the caret (row) switching between visual editing and source editing properly. Can you fix it? ... Also the 'wordwrap' button should be grey in source editing"

The caret synchronisation from spec 052 (block-level, switch-time) works for documents whose last content block is a paragraph or heading, but silently stops working for documents whose last content block is a list, table, code block, or quote. The visual editor keeps a trailing empty paragraph after such blocks so the caret has somewhere to land, and the markdown parser does not produce that paragraph. The two structures then disagree on their block counts, the correlation check refuses the mapping, and the writer is dropped at the top of the document instead of the block they were reading. This feature makes the block mapping engage for those documents as well, in both switching directions.

It also adjusts the Word Wrap toggle in the source toolbar: with word wrap off the button currently uses the plain background (white in the light theme), which reads as an ordinary button next to a neutral grey toolbar. The user wants the off state rendered in the app's neutral grey so the toggle reads as a secondary control until it is engaged, while keeping the accent highlight when word wrap is on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switching to source works in documents ending in a list, table, code block, or quote (Priority: P1)

A writer editing a long document whose last block is a list (or table, code block, quote) spots a sentence partway through, activates the source view, and expects the source caret to open on a line of the block they were reading, as it already does in documents ending in a paragraph. Today the sync silently falls back to the stored source context, so the source view opens at the top of the document.

**Why this priority**: This is the reported defect. The caret sync is either working or silently not working depending on the shape of the document's ending, which makes the feature feel broken.

**Independent Test**: Open a long document ending in a list, place the caret in a paragraph partway through, switch to source, and confirm the source caret sits on a line of that paragraph, revealed on screen. Repeat with the caret in a heading, and in the trailing list itself.

**Acceptance Scenarios**:

1. **Given** a long document whose last content block is a list, **When** the caret is in a paragraph partway through and the user switches to source view, **Then** the source caret lands on a line of that paragraph and the source view reveals it.
2. **Given** a document whose last content block is a table, code block, or quote, **When** the user switches to source view, **Then** the source caret lands on a line belonging to the content block that contained the visual caret.
3. **Given** a document whose last content block is a list and the visual caret sits at the very end of the document (in the trailing area), **When** the user switches to source view, **Then** the source caret lands on the last real content block, never the top of the document and never inside the frontmatter.

---

### User Story 2 - Returning to visual maps into the caret's block in such documents (Priority: P1)

A writer who moved the source caret or edited in the source view and returns to the visual editor expects the visual caret to land in the content block containing the source caret's final line, revealed on screen. Today, for documents ending in a list, table, code block, or quote, the mapped restore is refused by the count check and the stored-offset restore applies instead, which can land anywhere or clamp oddly.

**Why this priority**: A sync that only works one way would still strand the writer; the return path must engage for the same documents the entry path now supports.

**Independent Test**: Open a document ending in a list, switch to source, move the caret to a distant block, return, and confirm the visual caret sits in that block and is revealed; separately confirm the untouched round trip still restores exactly.

**Acceptance Scenarios**:

1. **Given** a document ending in a list, **When** the user moves the source caret to a block deep in the document and returns without editing, **Then** the visual caret lands in that block, revealed on screen.
2. **Given** the user edited in the source view and left the caret in the trailing list, **When** they return, **Then** the edit is preserved and the visual caret lands in the list block, clamped to a valid location.
3. **Given** an untouched, unedited round trip on such a document, **When** the user returns, **Then** the visual caret and scroll restore exactly as before the switch, unchanged from spec 052.

---

### User Story 3 - The Word Wrap toggle is grey when off (Priority: P2)

A writer in the source view sees the Word Wrap toggle at the far right of the toolbar. With word wrap off the button renders in the neutral grey of the app's surfaces; with word wrap on it keeps the accent highlight that reports the active state. The change is purely presentational.

**Why this priority**: A visual polish of an existing control; it does not affect the control's function, state reporting, or persistence.

**Independent Test**: Open the source view with word wrap off, confirm the button's background is the neutral grey; toggle it on and confirm the accent background and `aria-pressed` state; toggle off and confirm grey returns.

**Acceptance Scenarios**:

1. **Given** the source view with word wrap off, **When** inspected, **Then** the Word Wrap button renders with the app's neutral grey background.
2. **Given** the source view with word wrap on, **When** inspected, **Then** the button renders with the accent background and reports its state, unchanged from today.
3. **Given** either state, **When** the button is clicked, **Then** wrap changes immediately, the state reports correctly, and the choice persists as today.

---

### Edge Cases

- A caret at the very end of a document ending in a list (inside the trailing empty paragraph the visual editor keeps): maps to the last real content block, not the top of the document.
- A document whose visual structure genuinely ends with an empty paragraph that is not the trailing artifact: the leniency applies only when the extra block is exactly an empty paragraph, so a genuinely empty trailing paragraph with a matching parser block still correlates normally.
- Any other block-count mismatch (nested structures the editor and parser disagree on, unsupported nodes): keeps today's silent fallback to the stored context, with no error.
- Empty and single-block documents: unchanged; every position maps to the document start as today.
- Documents ending in a list when the source session's edit removes the list: the return mapping re-derives the block count from the current text and degrades to the stored-offset restore if the structures no longer align.
- CRLF documents, frontmatter, rapid toggling, and multi-tab independence: unchanged from spec 052.
- The Word Wrap visual change must not alter the toggle's operation, keyboard operability, accessibility state, persistence, or immediate application to open source views.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For a document whose last content block is a list, table, code block, or quote, switching from the visual editor to the source view MUST place the source caret on a line of the content block that contained the visual caret, rather than falling back to the stored context.
- **FR-002**: The correlation between the visual document's top-level blocks and the parsed text's blocks MUST ignore the visual editor's trailing empty paragraph (an artifact kept after such last blocks) so the counts align.
- **FR-003**: Returning to the visual editor after moving or editing the source caret MUST place the visual caret in the content block containing the source caret's final line for documents ending in a list, table, code block, or quote, revealed on screen.
- **FR-004**: The trailing-empty-paragraph leniency MUST apply only when the extra visual block is exactly an empty paragraph; any other count mismatch MUST keep today's silent fallback without error.
- **FR-005**: The Word Wrap toggle in the source toolbar MUST render with the app's neutral grey background when word wrap is off and the accent background when on.
- **FR-006**: The Word Wrap presentation change MUST NOT alter the toggle's operation, keyboard operability, accessibility state, persistence, or immediate application.
- **FR-007**: Neither fix MUST change document bytes, dirty state, undo history, or any stored per-tab context beyond the positioning already governed by spec 052.
- **FR-008**: Every mapping that cannot correlate MUST degrade to today's stored-context behaviour with zero errors and without resetting to the document start as a side effect of a successful correlation.

### Key Entities *(include if feature involves data)*

- **Trailing-empty-paragraph signal**: a boolean derived at switch time from the visual document's last top-level block, telling the correlation step to drop that block when counting. It is not stored and not persisted; the visual document's own structure is the authority at restore time.
- **Block-to-line correspondence**: the spec 052 block table, unchanged in shape. Its count check becomes lenient exactly as FR-002 and FR-004 describe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of switches to source from any caret position in a document ending in a list, table, code block, or quote, the source caret lands on a line of the containing content block rather than the top of the document.
- **SC-002**: In 100% of returns after moving or editing the source caret in such documents, the visual caret lands within the mapped content block and is revealed on screen.
- **SC-003**: In 100% of untouched, unedited round trips, the exact-restore guarantee from spec 052 is unchanged, including for documents ending in a list, table, code block, or quote.
- **SC-004**: In 100% of cases where the extra visual block is not an empty paragraph, the mapping degrades to today's stored-context behaviour with zero errors.
- **SC-005**: The Word Wrap toggle renders grey when off and accent when on in both light and dark themes, remains operable and keyboard-accessible, and persists across restarts.

## Assumptions

- **Root cause**: The trailing empty paragraph is a visual-editor artifact kept only so a document ending in a list, table, code block, or quote has a caret host. It carries no user content, is never part of the stored bytes, and is invisible in the visual editor.
- **Mapping unit unchanged**: The fix keeps spec 052's block-level mapping. Within-block row accuracy is not improved; landing on a line of the correct block remains the contract.
- **Leniency is structural**: The signal is read from the live visual document at switch time, not guessed from the text, so the fix only ever drops a block the editor actually added.
- **Grey tone**: The off-state grey uses the app's established neutral surface colour variable, so it adapts to the light and dark themes without new palette entries.
- **Scope**: Both fixes are renderer-only. There are no new IPC channels, files, settings, or persisted entities.