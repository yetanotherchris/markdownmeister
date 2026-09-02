# Feature Specification: Search Box for Visual Editing

**Feature Branch**: `055-visual-editor-search`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "search box for visual editing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find text in the visual document (Priority: P1)

A user reading or editing a document in visual mode wants to find every place a word or phrase occurs without scanning the page by eye. They open the search box, type, and matching text is highlighted in place while a count shows how many matches exist. The current match is visually distinct from the others and is brought into view.

**Why this priority**: Live matching with a visible count and a visible current match is the feature; without it the box does nothing of value.

**Independent Test**: Open a document that contains a word several times in visual editing, open the search box, type the word, and observe every occurrence highlighted with a match count shown.

**Acceptance Scenarios**:

1. **Given** a document is open in visual editing, **When** the user opens the search box by keyboard shortcut or visible control, **Then** a search input appears in the editing area without opening a separate window and the caret is not moved.
2. **Given** the search box is open, **When** the user types or edits the query, **Then** matches update live with each keystroke, with no separate submit step.
3. **Given** the query matches text in the document, **When** results are shown, **Then** every occurrence is highlighted, the current match is visually distinct from the rest, and a count in the form "current of total" is displayed.
4. **Given** matches exist, **When** a search begins or the query changes, **Then** the current match is scrolled into view.
5. **Given** the query matches text inside a heading, list item, quote, table, or code block, **When** results are shown, **Then** those occurrences are found and highlighted like any other.
6. **Given** the query matches nothing, **When** results are shown, **Then** the count shows zero matches in a calm way and no error or dialog appears.

---

### User Story 2 - Move between matches (Priority: P2)

The user steps through the matches with next and previous controls, and with their Enter and Shift+Enter equivalents while typing in the box. Navigation wraps around at both ends so it can never get stuck.

**Why this priority**: Stepping through matches is the normal rhythm once the first match appears; without it the user can only look at the first hit.

**Independent Test**: With several matches present, activate next and previous repeatedly and confirm the current match moves, wraps at both ends, and stays in view.

**Acceptance Scenarios**:

1. **Given** multiple matches, **When** the user activates next, **Then** the next occurrence becomes the current match, the count updates, and the match is scrolled into view.
2. **Given** the current match is the last one, **When** the user activates next, **Then** the current match wraps to the first occurrence.
3. **Given** multiple matches, **When** the user activates previous, **Then** the previous occurrence becomes current, wrapping to the last one from the first.
4. **Given** focus is in the search input, **When** the user presses Enter or Shift+Enter, **Then** the current match moves to the next or previous match respectively.
5. **Given** the search box is open, **When** the user edits the document, **Then** highlights and the count refresh against the edited content and the search box stays open.

---

### User Story 3 - Dismiss cleanly (Priority: P3)

The user closes the search box with Escape or its close control. The highlights disappear, the document content, dirty state, and undo history are untouched, and focus returns to the document so typing can continue immediately.

**Why this priority**: Clean dismissal is what makes the feature safe to keep open casually; it is simpler than the stories above but must hold unconditionally.

**Independent Test**: Open the search box in a clean document, search, close it, and confirm no highlights remain, the document is still clean, and the caret and content are unchanged.

**Acceptance Scenarios**:

1. **Given** the search box is open with matches, **When** the user presses Escape or the close control, **Then** the box closes and every highlight is removed.
2. **Given** the document was clean before searching, **When** the box is closed, **Then** the document is still clean and its content is unchanged.
3. **Given** the box is closed, **When** the user starts typing, **Then** keystrokes reach the document without an extra click (focus returned on close).
4. **Given** a search is open in one tab, **When** the user switches to another tab or to source view, **Then** the search is closed and opening it again starts with an empty query.

---

### Edge Cases

- What happens with a query that differs only in case from the text? Matching ignores case by default.
- What happens with an empty or whitespace-only query? No matches are highlighted and the count area shows no misleading numbers.
- What happens with a query containing punctuation or symbols? It is matched literally; it is never interpreted as a pattern.
- What happens in a very large document (10,000+ lines)? Searching stays responsive on every keystroke with no perceptible lag.
- What happens when the query is longer than any text in the document? Zero matches, calm zero state, no error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Visual editing MUST offer a search box for the open document, reachable both by a keyboard shortcut and by a visible control in the editing interface.
- **FR-002**: The search box MUST update matches live while the user types, without a separate submit step.
- **FR-003**: All occurrences of the query MUST be highlighted in the rendered document, and the current match MUST be visually distinct from the other matches.
- **FR-004**: The current match MUST be scrolled into view when a search begins, when the query changes, and on every navigation.
- **FR-005**: The search box MUST display the match count in the form "current of total".
- **FR-006**: The search box MUST provide next and previous navigation that wraps around at both ends.
- **FR-007**: While focus is in the search input, Enter MUST move to the next match and Shift+Enter to the previous match.
- **FR-008**: Escape and a close control MUST dismiss the search box, remove all highlights, and return focus to the document.
- **FR-009**: Searching MUST NOT change the document content, its dirty state, or its undo history.
- **FR-010**: Matching MUST be literal text matching, ignoring case by default; no case-sensitivity control and no pattern syntax are in scope.
- **FR-011**: Search MUST cover the whole open document, whatever block types it contains.
- **FR-012**: Search MUST stay responsive on every keystroke for documents up to 10,000 lines, with no perceptible typing lag while the box is open.
- **FR-013**: Search state MUST NOT carry across tab switches, view switches, or application restarts; a newly opened search box starts empty.

### Key Entities *(include if feature involves data)*

- **Search query**: The text being searched. It exists only while the search box is open, is never persisted, and is never part of the document.
- **Current match**: Which occurrence is selected. It is only meaningful while the box is open and always resets when the query changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate a phrase in a multi-page document in under 10 seconds by opening the box, typing, and reading the count, without scrolling manually.
- **SC-002**: Match highlighting and counts update with every keystroke with no perceptible lag for documents up to 10,000 lines.
- **SC-003**: Stepping through matches always makes progress or wraps; navigation never dead-ends.
- **SC-004**: After dismissal the document is exactly as before the search: identical content, identical dirty state, no residual highlights.
- **SC-005**: Normal use, including zero-match queries, never shows an error or interruption.

## Assumptions

- "Search box" means find only. Find-and-replace is out of scope for this feature and can be added later without changing these requirements.
- Matching is case-insensitive literal text. If a case-sensitivity toggle is wanted later, it is an addition, not a change to these requirements.
- The box docks within or overlays the editing area; it never opens a separate window or dialog.
- The keyboard shortcut follows the conventional find shortcut (Ctrl+F, Cmd+F on macOS); the exact assignment is recorded in the plan.
- Closing the search on tab or view switches is deliberate; per-tab search persistence was not requested.
