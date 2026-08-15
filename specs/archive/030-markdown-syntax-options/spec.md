# Feature Specification: Markdown Syntax and Formatting Options

**Feature Branch**: `030-markdown-syntax-options`

**Created**: 2026-08-13

**Status**: Archived

**Input**: User description: "I want to create a new spec, which will add to the settings various options that Milkdown provides. For example the various variations of markdown it might support (maybe 5-6 options)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Markdown Syntax Extensions (Priority: P1)

A writer can open the settings dialog, navigate to a dedicated Markdown settings area, and individually toggle specific markdown syntax extensions (such as strikethrough, tables, task lists, mathematical expressions, and autolinking) so that the editor recognizes and formats the exact markdown conventions relevant to their writing.

**Why this priority**: Different markdown workflows and publishing targets support different subsets of markdown syntax. Giving writers control over supported syntax ensures the visual editor matches their target platform without unwanted syntax parsing.

**Independent Test**: Open the settings dialog, navigate to the Markdown area, toggle an option (e.g., strikethrough or math expressions), and verify that text matching that syntax is immediately parsed into rich elements when enabled, or rendered as plain literal text when disabled.

**Acceptance Scenarios**:

1. **Given** the settings dialog is open, **When** the user views the sidebar navigation, **Then** a `Markdown` area entry is available alongside `General` and `Theme`.
2. **Given** the `Markdown` area is selected, **When** the user views the main settings panel, **Then** independent toggle switches are present for strikethrough, tables, task lists, math expressions, automatic link detection, and hard line breaks.
3. **Given** strikethrough formatting is enabled in settings, **When** the user types or views text enclosed in double tildes (`~~deleted~~`), **Then** the text renders with a visual strike-through line.
4. **Given** strikethrough formatting is disabled in settings, **When** the user views text with double tildes (`~~not struck~~`), **Then** the tildes and text render as literal characters without strikethrough styling.
5. **Given** math expressions are enabled, **When** a document contains inline (`$E=mc^2$`) or block math syntax (`$$\sum_{i=1}^n x_i$$`), **Then** the expressions render as formatted mathematical formulas.
6. **Given** math expressions are disabled, **When** a document contains dollar signs, **Then** the text and dollar signs render as literal plain text.
7. **Given** table formatting is disabled, **When** a document contains pipe-delimited table markdown, **Then** the content is presented as literal text lines rather than an interactive grid.
8. **Given** task list items are disabled, **When** a document contains `- [ ]` or `- [x]`, **Then** the brackets and text render as literal characters in standard list items rather than interactive checkboxes.
9. **Given** automatic link detection is disabled, **When** raw web addresses (e.g., `https://example.com`) are typed without explicit markdown link syntax, **Then** they remain plain text and do not convert into clickable hyperlinks.

---

### User Story 2 - Control Line Break Behavior (Priority: P1)

A writer can configure how single line breaks (soft returns) are interpreted in the formatted view, choosing between standard markdown paragraph flow (single newlines collapse to spaces) and hard line breaks (every return creates a visible line break).

**Why this priority**: Line break interpretation is one of the most divergent behaviors across markdown ecosystems. Technical writers and documentation authors often require strict CommonMark soft breaks, whereas conversational note-takers and chat-oriented writers expect single returns to produce visible new lines.

**Independent Test**: Open a document, type two lines separated by a single newline, toggle the "Convert single line breaks to hard breaks" setting, and verify the formatted view switches between continuous wrapped text and a two-line layout.

**Acceptance Scenarios**:

1. **Given** "Convert single line breaks to hard breaks" is disabled, **When** text has a single newline between lines within a paragraph, **Then** the text is displayed as a single continuous paragraph with a space between words.
2. **Given** "Convert single line breaks to hard breaks" is enabled, **When** text has a single newline between lines, **Then** the text displays on a new visual line within the same paragraph block.
3. **Given** the setting is toggled, **When** the user returns to the active editor, **Then** existing paragraphs adjust their visual line wrapping immediately.

---

### User Story 3 - Instant Application and Multi-Tab Synchronization (Priority: P2)

When a writer modifies any markdown syntax setting, the changes take effect immediately across all currently open document tabs without requiring an application restart, tab reload, or loss of unsaved changes.

**Why this priority**: Frictionless configuration requires immediate visual feedback. Requiring users to close and reopen documents or restart the app interrupts writing flow and risks state corruption.

**Independent Test**: Open multiple tabs containing various markdown elements, open the settings dialog, toggle multiple markdown syntax options, and verify all open tabs immediately reflect the updated formatting rules while preserving cursor positions, scroll offsets, and dirty indicators.

**Acceptance Scenarios**:

1. **Given** multiple document tabs are open with unsaved changes, **When** any markdown setting is toggled in the settings dialog, **Then** all open tabs update their rendering according to the new settings.
2. **Given** an open document is dirty (has unsaved edits), **When** a markdown setting is changed, **Then** the document's dirty status, unsaved modifications, and undo/redo history are preserved.
3. **Given** a document has an active cursor and scroll position, **When** a markdown setting is changed, **Then** the editor maintains the user's viewport and cursor location.

---

### User Story 4 - Setting Persistence Across Application Restarts (Priority: P2)

A writer's configured markdown syntax options are stored in the application's configuration and automatically restored when the application is launched again.

**Why this priority**: User preferences must be durable. Writers should not have to reconfigure their desired markdown flavor every time they launch the editor.

**Independent Test**: Change multiple markdown syntax options from their default values, quit the application, launch it again, open the settings dialog, and verify that all customized toggles retain their saved states.

**Acceptance Scenarios**:

1. **Given** custom markdown settings have been selected, **When** the application is closed and reopened, **Then** all markdown settings match the previously selected values.
2. **Given** a fresh application installation or missing configuration file, **When** the application starts, **Then** default markdown settings are populated automatically.

---

### Edge Cases

- **Toggling syntax with unclosed or partial formatting**: Unclosed syntax markers (e.g., a single opening tilde `~` or unmatched math dollar sign `$`) remain plain text in both enabled and disabled states and do not break the editor layout.
- **Saving documents containing disabled syntax features**: Saving a document when a syntax feature is disabled (e.g., math or tables disabled) saves the exact raw source text to disk without escaping, altering, or dropping the characters.
- **Switching between formatted view and raw source view**: Raw source view always displays the verbatim characters regardless of which syntax options are enabled in formatted view.
- **Rapid toggle switching in settings**: Rapidly changing multiple toggles in the settings dialog applies the final state smoothly without visual stutter or race conditions.
- **Corrupted or unreadable settings file**: If the configuration file cannot be parsed, safe default values are applied gracefully without crashing or throwing unhandled errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The settings dialog MUST include a `Markdown` navigation entry in its sidebar navigation list, positioned alongside `General` and `Theme`.
- **FR-002**: Selecting the `Markdown` sidebar entry MUST display the markdown syntax and formatting options in the main settings panel.
- **FR-003**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Convert single line breaks to hard breaks".
- **FR-004**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Strikethrough formatting (`~~text~~`)".
- **FR-005**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Tables formatting (`| column |`)".
- **FR-006**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Task list checkboxes (`- [ ]` / `- [x]`)".
- **FR-007**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Math and LaTeX expressions (`$...$` and `$$...$$`)".
- **FR-008**: The `Markdown` settings panel MUST provide an independent boolean toggle for "Automatic link detection for URLs and emails".
- **FR-009**: All markdown setting toggles MUST use sliding pill switch controls consistent with the switches in the `General` settings area.
- **FR-010**: Changes to markdown syntax settings MUST apply immediately to all active and background document tabs without requiring an application restart.
- **FR-011**: Updating markdown settings MUST NOT discard unsaved document edits, clear undo/redo history, or alter document dirty state.
- **FR-012**: All markdown settings MUST be persisted in the per-user configuration store and restored on application startup.
- **FR-013**: Default values for fresh installations MUST be:
  - Hard line breaks: disabled (`false`)
  - Strikethrough: enabled (`true`)
  - Tables: enabled (`true`)
  - Task lists: enabled (`true`)
  - Math expressions: enabled (`true`)
  - Automatic link detection: enabled (`true`)
- **FR-014**: When a syntax extension is disabled, the editor MUST treat its syntax delimiters as literal plaintext and MUST NOT format or transform the text into rich elements.
- **FR-015**: When a syntax extension is enabled, the editor MUST parse and format the corresponding markdown constructs into interactive/styled elements.

### Key Entities

- **Markdown Settings**: A structured set of configuration preferences containing boolean flags for each configurable markdown syntax extension (`hardBreaks`, `strikethrough`, `tables`, `taskLists`, `math`, `autolink`).
- **Markdown Syntax Extension**: An optional syntax specification beyond base CommonMark rules that enhances the editor with specialized structures (e.g., tables, strike-through, task checkboxes, math formulas, auto-detected links).
- **Line Break Mode**: The parsing rule controlling whether single newline characters within a paragraph are treated as soft breaks (spaces) or hard breaks (line breaks).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 6 markdown syntax options can be toggled independently in the settings dialog.
- **SC-002**: In 100% of tests, changing any markdown setting updates the visual presentation in all open tabs within 300 milliseconds.
- **SC-003**: In 100% of persistence tests, all configured markdown option values survive application restart.
- **SC-004**: In 100% of round-trip test cases, disabling syntax extensions does not cause character mangling, unexpected escaping, or data loss when saving documents.
- **SC-005**: Usability evaluation verifies that writers can navigate to the Markdown settings area and toggle a desired setting in under 10 seconds.

## Assumptions

- **Settings Apply Model**: Markdown syntax settings apply and persist immediately on toggle change, matching the immediate application model used for General-area settings.
- **Default State Rationale**: Strikethrough, tables, task lists, math expressions, and automatic links are enabled by default to provide a rich, modern editing experience out-of-the-box, while hard line breaks are disabled by default to follow standard CommonMark specification.
- **Raw Source View Immunity**: Raw source view always presents verbatim markdown text regardless of the toggle states of formatted view extensions.
- **No Document Content Mutation**: Disabling or enabling a syntax extension only changes the editor's parsing and visual formatting behavior; it never rewrites or alters the file's raw markdown text on disk.
- **Scope**: The 6 options specified cover the standard set of configurable markdown dialect and formatting extensions. Additional specialized plugins or custom markdown extensions may be added in future iterations.
