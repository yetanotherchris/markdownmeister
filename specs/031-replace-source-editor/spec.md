# Feature Specification: Replace Source Editor

**Feature Branch**: `phase-31-source-highlight`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "can you create a speckit spec (in a new branch) to set this as the replacement for the current view code textarea"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit highlighted markdown source (Priority: P1)

A writer opens a document's source view and can read and edit its raw markdown in a syntax-highlighted editing surface instead of a plain text field. Markdown structure is visually distinguished so the writer can scan the source more easily; when a document begins with frontmatter, that frontmatter is distinguished as YAML.

**Why this priority**: Replacing the existing source editing surface is the feature's core value. The replacement must remain a complete raw-markdown editor, not merely a read-only preview.

**Independent Test**: Open a markdown document containing YAML frontmatter and standard markdown in source view, verify that both are visibly syntax-highlighted, edit each area, and save the document.

**Acceptance Scenarios**:

1. **Given** an open markdown document in source view, **When** it contains headings, links, emphasis, lists, block quotes, or fenced-code delimiters, **Then** those markdown constructs are visually distinguished while the full document remains editable.
2. **Given** an open markdown document begins with YAML frontmatter, **When** it is displayed in source view, **Then** the frontmatter is visually distinguished from the markdown body.
3. **Given** a writer edits source text, **When** the edit changes markdown or YAML syntax, **Then** the displayed highlighting reflects the current text without interrupting typing.
4. **Given** a writer edits source text and saves, **When** the file is opened again, **Then** the saved raw markdown matches the writer's edits without added formatting changes.

---

### User Story 2 - Preserve source-view workflows (Priority: P1)

A writer can continue using source view as before: enter it, edit the full document, switch tabs, return to visual editing, and use existing unsaved-change protections without losing text, focus context, or the ability to save.

**Why this priority**: The replacement must not trade editing reliability for presentation. Source view is used for markdown that the visual editor may not preserve exactly.

**Independent Test**: Make unsaved source edits in one of two open documents, switch tabs, return, then return to visual editing and verify the edits and unsaved indicator are retained.

**Acceptance Scenarios**:

1. **Given** a source-view document with unsaved edits, **When** the writer switches tabs and returns, **Then** its edited text, selection context, and scroll position are retained.
2. **Given** a writer edits frontmatter, markdown body text, or code in source view, **When** the writer returns to visual editing, **Then** existing source-to-visual preservation behavior applies and the document remains unsaved until saved.
3. **Given** source view is active and spellcheck is enabled in settings, **When** the source contains ordinary prose, **Then** the existing source-view spellcheck behavior remains available.
4. **Given** a source-view document has unsaved edits, **When** the writer closes it, closes the window, or quits, **Then** the existing explicit unsaved-changes confirmation is shown.

---

### Edge Cases

- An empty document, a document without a trailing newline, and a document up to 10,000 lines remain editable without gratuitous content changes.
- A document contains malformed markdown, incomplete fences, or incomplete YAML frontmatter while the writer is typing: the editor keeps the raw text editable and does not discard or rewrite it to recover highlighting.
- A document begins with text that resembles frontmatter but is not a valid frontmatter block: it is treated as ordinary markdown and remains readable and editable.
- A document contains frontmatter, unsupported markdown extensions, or syntax the visual editor cannot represent: the existing raw-source preservation and unsaved-state behavior continues to apply.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Source view MUST replace the current plain text editing field with an editable syntax-highlighted source editing surface.
- **FR-002**: The source editing surface MUST show the complete raw document, including frontmatter, markdown body, fenced code, empty lines, and the presence or absence of a trailing newline.
- **FR-003**: The source editing surface MUST visually distinguish standard markdown syntax, including fenced-code delimiters, while preserving the ability to select, edit, copy, paste, and delete any source text.
- **FR-004**: When a document begins with YAML frontmatter, the source editing surface MUST visually distinguish that frontmatter from the markdown body.
- **FR-005**: Malformed or incomplete markdown and YAML frontmatter MUST remain readable and editable without changing document content.
- **FR-006**: Source edits MUST continue to update the existing document content, dirty-state, save, close, quit, external-change, and source-to-visual preservation flows.
- **FR-007**: Switching tabs while source view is active MUST retain each document's source text, selection context, and scroll position independently.
- **FR-008**: Entering source view or activating a tab already in source view MUST place input focus in the source editing surface without stealing focus from another active interaction.
- **FR-009**: The source editing surface MUST continue to honor the existing source-view spellcheck setting for ordinary prose.
- **FR-010**: The existing compact source-view toolbar and its clearly labeled return-to-visual-editing action MUST remain available.
- **FR-011**: The feature MUST NOT introduce filesystem access, a new renderer-to-main-process operation, or a change to existing save semantics.
- **FR-012**: The feature MUST NOT add autocomplete, code completion, language-specific code highlighting, source-editing commands, or other source-editor features beyond basic Markdown and YAML-frontmatter syntax highlighting.

### Key Entities

- **Source document**: The complete raw markdown text for an open document, including frontmatter and body, which remains the authoritative text for source editing and saving.
- **YAML frontmatter**: A document-leading metadata block that, when present, is visually distinguished from the markdown body.
- **Source editing context**: Per-document cursor or selection location and scroll position retained while the document is open in source view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a document containing headings, links, emphasis, lists, block quotes, fenced-code delimiters, and YAML frontmatter, all applicable Markdown and YAML constructs are visibly distinguished in source view and remain editable.
- **SC-002**: In automated end-to-end tests, 100% of source edits to frontmatter, markdown body, and fenced code survive source-to-visual switching and saving without unrequested text changes.
- **SC-003**: For documents up to 10,000 lines, at least 95% of normal typing interactions update the displayed source within 100 milliseconds and do not cause a focus loss or modal interruption.
- **SC-004**: In automated end-to-end tests, switching between two source-view tabs retains the edited source text, selection context, and scroll position for both tabs in 100% of tested cases.
- **SC-005**: In automated end-to-end tests, 100% of malformed Markdown and YAML-frontmatter cases remain editable and preserve their raw text.

## Assumptions

- The existing source-view entry points, compact return toolbar, visual editor, document model, save flow, and unsaved-change confirmations remain in scope and retain their current user-facing behavior.
- The first release covers standard Markdown syntax and YAML frontmatter only; language-specific highlighting inside fenced code is out of scope.
- The feature is limited to the editable source view. It does not change syntax presentation in visual editing, introduce a split editor/preview, autocomplete, code completion, or source-editing commands such as find-and-replace.
- The editor preserves the raw source as authored; highlighting is presentational and must not normalize line endings, whitespace, frontmatter, or markdown syntax.
