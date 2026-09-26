# Feature Specification: Find and Replace in the Editor

**Feature Branch**: `061-editor-find-replace`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "additional to the search facility, I want a replace functionality. Just simple string replace (no regex) for now. It should have a replace all toggle similar to other text editors like vscode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace one match at a time (Priority: P1)

A user has found a phrase in the open document. They reveal the replace row from the existing search box, type the replacement text, and replace the current match. That occurrence alone changes, the current match advances to the next remaining occurrence, and the document is marked as having unsaved changes.

**Why this priority**: Controlled, one-at-a-time replacement is the safe half of the feature: a user can inspect each change before committing it, which is exactly when a literal replace is preferable to a broad sweep.

**Independent Test**: Open a document with a word repeated several times in visual editing, search for it, reveal the replace row, type a replacement, activate replace, and confirm only the current occurrence changed and the count dropped by one.

**Acceptance Scenarios**:

1. **Given** the search box is open, **When** the user activates the replace toggle, **Then** a replace input and the replace controls appear without closing the search box, and the existing matches stay as they are.
2. **Given** a current match, **When** the user activates replace, **Then** only that occurrence is replaced with the replacement text, the document becomes dirty, the match total decreases by one, and the current match advances to the next remaining occurrence.
3. **Given** the replacement text is empty, **When** the user activates replace, **Then** the current occurrence is deleted.
4. **Given** there are no matches, **When** the user activates replace, **Then** the document is unchanged and the replace controls are inert.
5. **Given** a replacement was made, **When** the user issues undo, **Then** the replacement is undone in a single step and the previous content returns.

---

### User Story 2 - Replace every match at once (Priority: P1)

A user wants to rename a term throughout the document. With matches shown and a replacement entered, they activate Replace All and every occurrence in the open document changes in one action, after which the count reflects the result and the document is dirty ready to save.

**Why this priority**: Replace All is the reason replace exists for most users; doing it one match at a time across a long document is the tedious work this removes.

**Independent Test**: Open a document with many occurrences, search, enter a replacement, activate Replace All, and confirm every occurrence changed exactly once and the document is dirty.

**Acceptance Scenarios**:

1. **Given** matches exist and a replacement is entered, **When** the user activates Replace All, **Then** every occurrence in the open document is replaced in a single action.
2. **Given** Replace All ran, **When** the result is displayed, **Then** the match total reflects the new content (for example zero when every occurrence was replaced) and the document is dirty.
3. **Given** Replace All ran, **When** the user issues undo once, **Then** every replacement made by that action is undone together in a single step.
4. **Given** there are no matches, **When** the user activates Replace All, **Then** the document is unchanged.
5. **Given** the replacement text itself contains the search term, **When** Replace All runs, **Then** only the original occurrences are replaced; inserted replacement text is never re-processed.

---

### User Story 3 - Replacement is safe, scoped, and view-consistent (Priority: P2)

Replace works the same whether the user is in visual editing or source editing, is scoped to the single open document, participates correctly in undo and dirty tracking, and leaves no residue when the search box is dismissed.

**Why this priority**: A replace that silently touched other documents, broke undo, or corrupted content would be worse than no replace at all; these guarantees make the feature trustworthy.

**Independent Test**: Perform a replace in each view, undo it, dismiss the box, and confirm content, dirty state, undo history, and highlights are exactly as expected.

**Acceptance Scenarios**:

1. **Given** visual editing, **When** a replacement is performed, **Then** it is applied through the document's normal editing model so dirty tracking, undo, and caret behaviour match ordinary typing.
2. **Given** source editing, **When** a replacement is performed, **Then** it is applied through the text's normal editing model with the same dirty, undo, and caret guarantees.
3. **Given** a replacement has been performed, **When** the search box is dismissed, **Then** no highlight or search overlay remains and only the intended replacements persist.
4. **Given** replace has been used, **When** the user continues typing, **Then** earlier edits made before the search opened remain undoable in order.
5. **Given** a search performed in one view, **When** the user switches view or tab, **Then** replacement state does not carry over and reopening the box starts empty.

---

### Edge Cases

- A query that is empty or whitespace-only matches nothing, so replace and Replace All are inert and the count area shows no misleading numbers.
- A query that differs only in case from the text still matches, because matching is case-insensitive, and the replacement text is inserted exactly as typed (no case preservation).
- A query containing markdown syntax characters (asterisks, brackets, pipes) is matched and replaced literally; it is never interpreted as a pattern.
- An empty replacement deletes the matched text.
- A replacement whose text contains the query, or a query that appears inside another query (overlapping occurrences), never causes a replaced stretch to be replaced again within the same action.
- Replace covers the whole open document, including headings, list items, quotes, tables, code blocks, and (in source view) the frontmatter block.
- A document with thousands of occurrences replaces and re-renders without perceptible lag.
- If the document changes between finding and replacing (for example an external edit), replacement applies to the current content and never to stale positions.
- Replace never runs across multiple documents; only the open document is affected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both editing views (visual and source) MUST offer replace from the existing search box, revealed by a toggle, so find keeps its current behaviour unchanged.
- **FR-002**: The replace row MUST provide a replacement text input, a replace-current control, and a replace-all control.
- **FR-003**: Matching for replace MUST be literal and case-insensitive, identical to find; no pattern syntax and no case-sensitivity toggle are in scope.
- **FR-004**: Replacing the current match MUST change only that occurrence and advance the current match to the next remaining occurrence.
- **FR-005**: Replace All MUST change every occurrence of the query in the open document in a single user action.
- **FR-006**: Each replace action MUST mark the document dirty and MUST be undoable as a single step (one step per action, not one per occurrence).
- **FR-007**: Replace MUST be scoped to the single open document and MUST NOT modify any other open document or file.
- **FR-008**: Replace MUST NOT re-process text inserted by the same action, so a replacement containing the query does not cause repeated replacement.
- **FR-009**: An empty replacement MUST delete the matched text.
- **FR-010**: When there are no matches, the replace controls MUST be inert and MUST NOT change the document.
- **FR-011**: Dismissing the search box MUST remove all search highlighting while leaving performed replacements in place.
- **FR-012**: Replace MUST preserve the document's pre-existing undo history, kept in order with the replacements.
- **FR-013**: Replace MUST stay responsive on normal typing and replacement for documents up to 10,000 lines.
- **FR-014**: The replacement text input MUST be reachable from the search box without opening a separate window or dialog.
- **FR-015**: Replace state (query, replacement, current match) MUST NOT persist across tab switches, view switches, or application restarts.
- **FR-016**: Replace MUST NOT change the word wrap setting, and MUST NOT scroll or select beyond what placing the current match and the replacements requires.

### Key Entities *(include if feature involves data)*

- **Query**: The text being searched, shared with find; literal, case-insensitive, never persisted.
- **Replacement text**: The text the user supplies to substitute; never persisted and never part of the document unless a replace is performed.
- **Current match**: The occurrence a single replace acts on; only meaningful while the box is open and reset when the query changes.
- **Replace action**: One user-initiated operation (single or all) that produces one undo step and one dirty transition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can rename a repeated term throughout a document in one action without using any other tool.
- **SC-002**: A single undo after Replace All restores the document byte-for-byte to its state before the action.
- **SC-003**: In a Replace All over a document with a known occurrence count, exactly that number of occurrences change, none missed and none changed twice.
- **SC-004**: Replacements and the updated count appear without perceptible lag for documents up to 10,000 lines.
- **SC-005**: A replace never changes any occurrence outside the open document, verified by comparing other open/closed files before and after.
- **SC-006**: After dismissing the box, no residual highlight remains and every performed replacement is intact.

## Assumptions

- "Simple string replace" means literal, case-insensitive matching identical to find, with no regular expressions and no case-sensitivity toggle; a pattern or case toggle would be an addition, not a change to these requirements.
- The replacement text is inserted verbatim; preserving the original occurrence's capitalisation ("preserve case") is out of scope.
- Replace is scoped to the currently open document; workspace-wide or multi-file replace is out of scope.
- The visual and source views share one search box, so both gain replace together; specs 055 and 056 anticipated this addition and their find behaviour is otherwise preserved.
- Replace applies through each view's normal editing path, so unsaved changes, undo, and the dirty flag follow the same rules as typing.
- The exact keyboard shortcut for replace and Replace All is recorded in the plan; the feature is always available through visible controls.

## Clarifications

### 2026-09-26 (during specification)

- **Literal only**: The user asked for "simple string replace (no regex)"; regular-expression replacement and a case-sensitivity toggle are explicitly out of scope.
- **Both editor views**: Replace is added to the shared search box, so it appears in both visual editing and source editing; the user confirmed the search facility is the one shared by both.
- **Scope**: Replacement affects only the open document. The "replace all" control matches the conventional editor behaviour (a single action over the whole document), as requested.
