# Feature Specification: Explorer Content Search

**Feature Branch**: `059-explorer-content-search` (implemented on the `spec-057-explorer-file-search` branch as an additive spec, per request)

**Created**: 2026-09-05

**Status**: Archived

**Input**: User description: "The file search you've created is great, and keep its existing behaviour. But it should also search all file contents (AFTER searching filenames: filenames take precedence)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a file by a phrase in its contents (Priority: P1)

A user remembers a phrase that appears inside a document but does not remember the file name. They type the phrase into the explorer search box. The tree filters to files whose contents contain the phrase, exactly as it already filters to files whose names contain it, so the file surfaces even if it sits in a folder that was never opened.

**Why this priority**: Name search already exists; remembering a document's words rather than its name is the common complementary case, and it is the whole reason this spec exists.

**Independent Test**: Put a unique phrase inside a file in a folder never expanded, type the phrase, and observe the file appear with its ancestor folders visible.

**Acceptance Scenarios**:

1. **Given** a workspace is open, **When** the user types a term, **Then** files whose contents contain the term (case-insensitively) appear in the tree as matches, in addition to filename matches.
2. **Given** a matching file sits in a folder that was never opened, **When** the term matches its contents, **Then** the file becomes visible with its ancestor folders visible.
3. **Given** a file's name does not contain the term but its contents do, **When** the term is active, **Then** the file is shown as a match anyway.
4. **Given** a file's name contains the term, **When** the term is active, **Then** the file is shown as before, and showing content matches never hides it (filenames take precedence).

### User Story 2 - Content search is read-only and resets (Priority: P2)

Searching contents must never change the file, its dirty state, or any document. Clearing the term clears content matches and returns the tree to its pre-filter state.

**Why this priority**: A search that modified documents would be a data-loss bug; the existing name-search reset behaviour must extend to the content half.

**Independent Test**: Open a file found by content match, edit it, clear the search, and confirm the edit and dirty state are untouched.

**Acceptance Scenarios**:

1. **Given** a file was found by a content match, **When** the user opens and edits it, **Then** the document saves normally and no search-induced change appears.
2. **Given** a term is active, **When** the user clears it (deleting text, the clear control, or Escape), **Then** content matches are removed and the tree returns to its pre-filter state.
3. **Given** a term is active, **When** the user opens a different workspace or restarts, **Then** the search box and all content matches reset.

### User Story 3 - Common phrases stay responsive (Priority: P3)

A phrase that occurs in many files (for example "the") must still return results without perceptible lag, and must not block typing.

**Why this priority**: Content search reads whole files; without a bounded, debounced scan it would make the search box feel broken.

**Independent Test**: Type a very common word and observe the matches appear promptly and typing stays responsive.

**Acceptance Scenarios**:

1. **Given** a workspace with thousands of files, **When** the user types a common term, **Then** content matches appear without perceptible lag and the search box stays responsive.
2. **Given** a file is too large to scan or unreadable, **When** the term is active, **Then** the file is skipped without any error or dialog.

---

### Edge Cases

- A term matching a word in a file's frontmatter or title counts as a content match.
- Case-insensitive matching for content, matching the name-search behaviour; no pattern syntax.
- Non-markdown files are never content-searched; only files the tree would list (`.md`, `.markdown`).
- Oversized or unreadable files are skipped, never surfaced as errors.
- Symlinked directories and files are not followed or scanned (the search stays inside the workspace root).
- A term that matches neither names nor contents shows the existing calm empty-state message.
- A whitespace-only term filters nothing and triggers no content search.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a term is active, the explorer MUST additionally search the contents of markdown files in the workspace.
- **FR-002**: Content matching MUST be a case-insensitive substring test on file contents, with no pattern syntax.
- **FR-003**: Filename matches MUST continue to appear exactly as before, and content matches MUST appear in addition; content matches MUST never hide or reorder filename matches (filenames take precedence).
- **FR-004**: Content matches inside folders that were never opened MUST become visible, with every ancestor folder of a match kept visible.
- **FR-005**: A file whose contents match but whose name does not MUST still appear as a match.
- **FR-006**: Content search MUST NOT modify any file or document; it is strictly read-only.
- **FR-007**: Clearing the term MUST clear content matches and return the tree to its pre-filter state, with the same restore behaviour as the existing name search.
- **FR-008**: The term and its content matches MUST NOT persist across workspace changes or restarts.
- **FR-009**: When a term matches neither names nor contents, the existing calm empty-state message MUST show.
- **FR-010**: Content search MUST be debounced and MUST stay responsive on every keystroke for workspaces with thousands of files.
- **FR-011**: Only markdown files (`.md`, `.markdown`) MUST be content-searched, consistent with what the tree lists.
- **FR-012**: Oversized or unreadable files MUST be skipped silently, never producing an error or dialog.

### Key Entities *(include if feature involves data)*

- **Content match set**: The relative paths of markdown files whose contents contain the current term. It exists only while the term is active, is never persisted, and never alters the files it names.
- **Loaded ancestor folders**: Folders expanded (loaded) so a content match inside them can be displayed. Loading is the same operation as a user expanding a folder and persists after clearing, exactly as a manual expansion would.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find a file by a remembered content phrase in a 500-file workspace in under 5 seconds, including opening it.
- **SC-002**: Content search responds without perceptible lag on a 5,000-file workspace, and typing is never blocked.
- **SC-003**: Filename matches never disappear or reorder when content matches exist.
- **SC-004**: No file or document is ever modified by a content search, verified by byte-identical content before and after.

## Assumptions

- Content search covers the whole workspace, including folders never opened in the tree; this is the point of the feature.
- Content matching is case-insensitive substring, consistent with name matching; no pattern syntax.
- "Filenames take precedence" means filename matches are the unchanged primary result and content matches are an additional net; in the tree the two coexist without reordering.
- Search is strictly read-only; it never gates or rewrites create, rename, move, delete, or save operations.
- A file counts as a content match even when the term appears only in frontmatter or a title.

## Clarifications

- 2026-09-05: The user chose "alongside" over a fallback: when a term matches both names and contents, both result kinds appear in the tree together. Filenames take precedence in the sense that existing name-search behaviour is untouched and never masked by content matches.
- 2026-09-05: This is an additive spec implemented on the `spec-057-explorer-file-search` branch alongside the name search it extends; the branch carries both.