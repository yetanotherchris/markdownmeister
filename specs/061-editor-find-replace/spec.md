# Feature Specification: Find and Replace in the Editor

**Feature Branch**: `061-editor-find-replace`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "additional to the search facility, I want a replace functionality. Just simple string replace (no regex) for now. It should have a replace all toggle similar to other text editors like vscode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace one match at a time (Priority: P1)

A user has found a phrase in the open document. They reveal the replace row from the existing search box, type the replacement text, and replace the current match. That occurrence alone changes, the current match advances to the next remaining occurrence, the match total is recomputed from the edited document, and the document is marked as having unsaved changes.

**Why this priority**: Controlled, one-at-a-time replacement is the safe half of the feature: a user can inspect each change before committing it, which is exactly when a literal replace is preferable to a broad sweep.

**Independent Test**: Open a document with a word repeated several times in visual editing, search for it, reveal the replace row, type a replacement, activate replace, and confirm only the current occurrence changed, the document is dirty, and the match total was recomputed from the edited text.

**Acceptance Scenarios**:

1. **Given** the search box is open, **When** the user activates the replace toggle, **Then** a replace input and the replace controls appear without closing the search box, and the existing matches stay as they are.
2. **Given** a current match, **When** the user activates replace, **Then** only that occurrence is replaced with the replacement text, the document becomes dirty, and the match total is recomputed from the edited document. The current match advances to the next remaining occurrence after the replaced range; if the replacement itself still matches the query it is offered as a later match, but it is never replaced by the same action.
3. **Given** the replacement text is empty, **When** the user activates replace, **Then** the current occurrence is deleted.
4. **Given** there are no matches, **When** the user activates replace, **Then** the document is unchanged and the replace controls are inert.
5. **Given** a replacement was made, **When** the user issues undo, **Then** the replacement is undone in a single step and the previous content returns.

---

### User Story 2 - Replace every match at once (Priority: P1)

A user wants to rename a term throughout the document. With matches shown and a replacement entered, they activate Replace All and every non-overlapping occurrence in the open document changes in one action, after which the count is recomputed and the document is dirty ready to save.

**Why this priority**: Replace All is the reason replace exists for most users; doing it one match at a time across a long document is the tedious work this removes.

**Independent Test**: Open a document with many occurrences, search, enter a replacement, activate Replace All, and confirm every non-overlapping occurrence changed exactly once (scanning left to right) and the document is dirty.

**Acceptance Scenarios**:

1. **Given** matches exist and a replacement is entered, **When** the user activates Replace All, **Then** every non-overlapping occurrence of the query in the open document is replaced in a single action, scanning left to right.
2. **Given** Replace All ran, **When** the result is displayed, **Then** the match total is recomputed from the new content (for example zero when every occurrence was replaced) and the document is dirty.
3. **Given** Replace All ran, **When** the user issues undo once, **Then** every replacement made by that action is undone together in a single step.
4. **Given** there are no matches, **When** the user activates Replace All, **Then** the document is unchanged.
5. **Given** the replacement text itself contains the search term, **When** Replace All runs, **Then** only the original occurrences are replaced; inserted replacement text is never re-processed.
6. **Given** the query can match overlapping stretches (for example `ana` in `banana`), **When** Replace All runs, **Then** the leftmost non-overlapping occurrences are replaced, no character is changed twice, and the recomputed count reflects the result.

---

### User Story 3 - Replacement is safe, scoped, and view-correct (Priority: P2)

Replace is available in both visual editing and source editing, follows each view's search scope, is scoped to the single open document, participates correctly in undo and dirty tracking, and leaves no residue when the search box is dismissed.

**Why this priority**: A replace that silently touched other documents, broke undo, corrupted content, or promised identical reach in two different views would be worse than no replace at all; these guarantees make the feature trustworthy.

**Independent Test**: Perform a replace in each view, undo it, dismiss the box, and confirm content, dirty state, undo history, and highlights are exactly as expected, including after undoing a replacement in a document that had a pre-existing unsaved edit.

**Acceptance Scenarios**:

1. **Given** visual editing, **When** a replacement is performed, **Then** it is applied through the document's normal editing model, so dirty tracking, undo, and caret behaviour match ordinary typing, and it replaces text in the rendered document (the same text find highlights).
2. **Given** source editing, **When** a replacement is performed, **Then** it is applied through the text's normal editing model with the same dirty, undo, and caret guarantees, and it replaces raw markdown, including the frontmatter block.
3. **Given** a replacement has been performed, **When** the search box is dismissed, **Then** no highlight or search overlay remains and only the intended replacements persist.
4. **Given** replace has been used, **When** the user continues typing, **Then** earlier edits made before the search opened remain undoable in order.
5. **Given** a search performed in one view, **When** the user switches view or tab, **Then** replacement state does not carry over and reopening the box starts empty.
6. **Given** a document with a pre-existing unsaved edit, **When** a replacement is performed and then undone, **Then** the document returns to its exact pre-action content, its dirty state is recomputed against the saved version (dirty if the earlier edit remains, clean if it does not), and the earlier edit is still undoable.
7. **Given** a match that spans differently formatted inline text, **When** it is replaced, **Then** the replacement is inserted as plain text taking the formatting in effect at the first character of the match, and no text outside the matched range changes formatting.

---

### Edge Cases

- A query that is empty or whitespace-only matches nothing, so replace and Replace All are inert and the count area shows no misleading numbers.
- A query that differs only in case from the text still matches, because matching is case-insensitive, and the replacement text is inserted exactly as typed (no case preservation).
- A query containing markdown syntax characters (asterisks, brackets, pipes) is matched and replaced literally; it is never interpreted as a pattern.
- An empty replacement deletes the matched text.
- Overlapping candidate matches (for example `ana` in `banana`) are resolved by one deterministic rule: matches are taken left to right and, after a match is changed, the scan resumes after the changed text, so no character is replaced twice. Where the find view highlights overlapping candidates, Replace All may therefore change fewer occurrences than were highlighted, and the count is recomputed afterwards.
- A replacement whose text contains the query never causes the inserted text to be replaced again within the same action.
- Replacement follows the view's search scope: in visual editing it applies to the rendered document text, and in source editing to the raw markdown, including the frontmatter block. A query that matches raw markdown syntax (for example `**`) therefore matches in source view only.
- Where a match spans differently formatted inline text, the replacement is inserted as plain text taking the formatting at the first character of the match; no content outside the matched range changes formatting.
- Replacement is a literal text substitution. It does not specially protect or reinterpret structural markdown (frontmatter delimiters, code fences); the edit is applied literally and the document is saved and reopened without reformatting content outside the match.
- A document with thousands of occurrences replaces and re-renders without perceptible lag.
- If the document changes between finding and replacing (for example an external edit), replacement applies to the current content and never to stale positions.
- Replace never runs across multiple documents; only the open document is affected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both editing views (visual and source) MUST offer replace from the existing search box, revealed by a toggle, so find keeps its current behaviour unchanged.
- **FR-002**: The replace row MUST provide a replacement text input, a replace-current control, and a replace-all control.
- **FR-003**: Matching for replace MUST be literal and case-insensitive, identical to find; no pattern syntax and no case-sensitivity toggle are in scope.
- **FR-004**: Replacing the current match MUST change only that occurrence, MUST NOT re-scan text it has just inserted, and MUST advance the current match to the next remaining occurrence after the replaced range.
- **FR-005**: Replace All MUST change every occurrence of the query in the open document in a single user action, using the deterministic non-overlapping policy in FR-017.
- **FR-006**: Each replace action MUST mark the document dirty and MUST be undoable as a single step (one step per action, not one per occurrence). Undoing a replace action MUST restore the document to its exact pre-action content, with the dirty state recomputed against the saved version, and MUST NOT merge with adjacent ordinary typing as one undo step.
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
- **FR-017**: Find, navigation, and replacement MUST use one deterministic matching policy: matches are considered left to right and, after a match is changed, the scan continues after the changed text, so no position is changed twice in one action.
- **FR-018**: Replacement scope MUST follow the view's search scope: visual editing replaces rendered document text, and source editing replaces raw markdown including the frontmatter block.
- **FR-019**: The replacement MUST be inserted as plain text and MUST NOT change formatting outside the matched range.
- **FR-020**: Replace MUST perform a literal text substitution and MUST NOT specially protect or reinterpret structural markdown; the surrounding document is not reformatted.
- **FR-021**: Undoing a replace action MUST restore the exact content before that action and recompute the dirty state against the saved version.

### Key Entities *(include if feature involves data)*

- **Query**: The text being searched, shared with find; literal, case-insensitive, never persisted.
- **Replacement text**: The text the user supplies to substitute; never persisted and never part of the document unless a replace is performed.
- **Current match**: The occurrence a single replace acts on; only meaningful while the box is open and reset when the query changes.
- **Replace action**: One user-initiated operation (single or all) that produces one undo step and one dirty transition.
- **Replacement policy**: The deterministic left-to-right rule that resolves matches, including overlapping candidates, identically for find, navigation, and replacement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can rename a repeated term throughout a document in one action without using any other tool.
- **SC-002**: A single undo after Replace All restores the open document's content exactly as it was before the action (the same content a save would write) and returns its dirty state to what it was.
- **SC-003**: In a Replace All over a document whose query matches are non-overlapping, exactly those occurrences change, none missed and none changed twice. Where the find view highlights overlapping candidates, Replace All changes the leftmost non-overlapping set and the count is recomputed.
- **SC-004**: Replacements and the recomputed count appear without perceptible lag for documents up to 10,000 lines.
- **SC-005**: A replace never changes any occurrence outside the open document, verified by comparing other open/closed files before and after.
- **SC-006**: After dismissing the box, no residual highlight remains and every performed replacement is intact.
- **SC-007**: After undoing a replacement in a document with a pre-existing unsaved edit, the document is dirty and its content matches the pre-replace state.

## Assumptions

- "Simple string replace" means literal, case-insensitive matching identical to find, with no regular expressions and no case-sensitivity toggle; a pattern or case toggle would be an addition, not a change to these requirements.
- The replacement text is inserted verbatim; preserving the original occurrence's capitalisation ("preserve case") is out of scope.
- Replace is scoped to the currently open document; workspace-wide or multi-file replace is out of scope.
- The visual and source views share one search box, so both gain replace together; specs 055 and 056 anticipated this addition and their find behaviour is otherwise preserved.
- Replace applies through each view's normal editing path, so unsaved changes, undo, and the dirty flag follow the same rules as typing.
- Matching and replacement use one deterministic non-overlapping left-to-right policy. Where the find view highlights overlapping candidates, Replace All changes the leftmost non-overlapping set and recomputes the count, so the number of replacements can be lower than a raw match count.
- Visual replace operates on rendered text and source replace on raw markdown, so the two views intentionally have different reach for queries that only match raw syntax.
- Replacement is inserted as plain text; preserving case or formatting is not attempted.
- The exact keyboard shortcut for replace and Replace All is recorded in the plan; the feature is always available through visible controls.

## Clarifications

### 2026-09-26 (during specification)

- **Literal only**: The user asked for "simple string replace (no regex)"; regular-expression replacement and a case-sensitivity toggle are explicitly out of scope.
- **Both editor views**: Replace is added to the shared search box, so it appears in both visual editing and source editing; the user confirmed the search facility is the one shared by both.
- **Scope**: Replacement affects only the open document. The "replace all" control matches the conventional editor behaviour (a single action over the whole document), as requested.

### 2026-09-26 (revision after independent review)

- **Match count is derived, not decremented by one**: the match total is recomputed from the edited document, so a replacement that still contains the query does not falsely reduce the count.
- **Deterministic overlap policy**: left-to-right, non-overlapping replacement is specified because the find view can highlight overlapping candidates that cannot all be independently replaced.
- **View scope made explicit**: visual replace acts on rendered text and source replace on raw markdown including frontmatter; the previous "works the same" wording was corrected.
- **Formatting and structure**: inserted text is plain and takes the formatting at the match start; structural markdown is treated as literal text rather than protected.
- **Undo and dirty boundaries**: undo restores the exact pre-action content and recomputes dirty state against the saved version.
