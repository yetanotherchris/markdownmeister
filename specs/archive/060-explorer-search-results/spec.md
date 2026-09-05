# Feature Specification: Explorer Search Results

**Feature Branch**: `060-explorer-search-results` (implemented on the `spec-057-explorer-file-search` branch, amending the search presentation from specs 057 and 059, per request)

**Created**: 2026-09-05

**Status**: Archived

**Input**: User description: "I want to amend the file search spec, so it follows VS Code." Features: results grouped into collapsible file sections (icon, name, directory path, chevron); a circular hit-count badge per file; contextual snippets (the matching line, truncated with ellipses); query-term highlighting within snippets; and an overall summary line of total matching instances.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search results read like a report, not a tree (Priority: P1)

A user types a term into the explorer search box. The tree area is replaced by a results view: a summary line ("N matches in M files"), then one collapsible section per matched file. Each section shows the file icon, name, directory path, an expand/collapse chevron, and a circular badge with the number of matches in that file. Sections are expanded by default so the matching lines are visible immediately; each matching line is a snippet with the term highlighted and long lines truncated with ellipses.

**Why this priority**: Presenting results by file with counts and snippets is the VS Code behaviour the user asked for; it turns the search from "filter the tree" into "report the hits".

**Independent Test**: Search a term that appears in several files; observe the summary, the per-file sections with badges, and highlighted snippet lines.

**Acceptance Scenarios**:

1. **Given** a term is active, **When** the results view is shown, **Then** a summary line states the total number of matching instances across all matched files.
2. **Given** matching files exist, **When** the results view is shown, **Then** each matched file is a section with a file icon, its name, its directory path, an expand/collapse chevron, and a circular badge showing the number of matches in that file.
3. **Given** a file has matches, **When** its section renders, **Then** it is expanded by default and shows one snippet per matching line.
4. **Given** a snippet line is long, **When** it renders, **Then** it is truncated with ellipses on the truncated sides while keeping the match visible.
5. **Given** a snippet line, **When** it renders, **Then** every occurrence of the query term is highlighted with a distinct background.

### User Story 2 - Name and content matches coexist in the results (Priority: P1)

A file whose name matches the term and a file whose contents match both appear. A name match shows a section with a badge of 1 and no content snippet; a content match shows the occurrence count and snippets. A file that is both shows its content matches, and the name is not counted twice.

**Why this priority**: The prior "filenames take precedence" behaviour carries over: name matches are shown and never hidden by content matches, and both kinds are visible in the same report.

**Independent Test**: Search a term that matches one file's name and another file's content; observe both sections with the correct badges.

**Acceptance Scenarios**:

1. **Given** a file's name contains the term, **When** the results view is shown, **Then** the file appears as a section with a badge of 1 and no content snippet.
2. **Given** a file's contents contain the term, **When** the results view is shown, **Then** the file appears as a section with a badge equal to the number of occurrences and snippets for each matching line.
3. **Given** a file matches both by name and by content, **When** the results view is shown, **Then** it appears once, showing its content matches.

### User Story 3 - Results are actionable and temporary (Priority: P2)

Clicking a file section or a snippet opens the file exactly as activating it in the unfiltered tree would, following the existing open behaviour and duplicate-tab rules. Clearing the term (Escape, the clear control, or deleting the text) removes the results view and returns the tree exactly as it was.

**Why this priority**: Results are a means to an end (opening the file), and the search must not leave the tree changed.

**Independent Test**: Click a snippet, confirm the file opens; clear the search and confirm the tree is unchanged.

**Acceptance Scenarios**:

1. **Given** a results view showing a file, **When** the user clicks the file section or a snippet, **Then** the file opens with exactly the same behaviour as activating it in the tree, including the duplicate-tab focus rule.
2. **Given** a term is active, **When** the user clears it, **Then** the results view is removed and the tree returns exactly to its pre-search state (expansion and selection untouched, because the tree is never modified while searching).
3. **Given** a term is active, **When** the user opens a different workspace or restarts, **Then** the search box and results reset.

---

### Edge Cases

- A term with no matches in names or contents shows the existing calm empty-state message.
- A whitespace-only term filters nothing and shows the tree.
- A file with matches on several different lines shows each matching line as a separate snippet.
- A line containing the term more than once counts each occurrence in the badge but appears once as a snippet.
- A very long matching line is truncated with ellipses around the match, never scrolling sideways.
- Create, rename, move, and delete are performed from the tree; while a search is active the tree is hidden, so these operations require clearing the search first (a documented change from spec 057).
- Search is strictly read-only; opening a file from results never modifies it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While a term is active, the explorer MUST show a results view in place of the tree.
- **FR-002**: The results view MUST show a summary line with the total number of matching instances across all matched files.
- **FR-003**: Matched files MUST be grouped into collapsible sections, each showing a file icon, the file name, its directory path, and an expand/collapse chevron.
- **FR-004**: Each file section MUST show a circular badge with the number of matches in that file.
- **FR-005**: File sections MUST be expanded by default and MUST be collapsible.
- **FR-006**: Each expanded section MUST show one snippet per matching line, and long lines MUST be truncated with ellipses on the truncated sides while keeping the match visible.
- **FR-007**: Every occurrence of the query term in a snippet MUST be highlighted with a distinct background.
- **FR-008**: Filename matches and content matches MUST both appear; a name match shows a badge of 1 with no content snippet, and a file matching both appears once.
- **FR-009**: Clicking a file section or a snippet MUST open the file with exactly the existing open behaviour, including duplicate-tab rules.
- **FR-010**: Clearing the term MUST remove the results view and return the tree exactly to its pre-search state.
- **FR-011**: The term and its results MUST NOT persist across workspace changes or restarts.
- **FR-012**: When a term matches neither names nor contents, the existing calm empty-state message MUST show.
- **FR-013**: A whitespace-only term MUST filter nothing and show the tree.
- **FR-014**: Results MUST stay responsive on every keystroke for thousands of matches (debounced, asynchronous scan).
- **FR-015**: Content search MUST be strictly read-only.
- **FR-016**: Escape in the search box MUST clear the term and return focus to the tree.

### Key Entities *(include if feature involves data)*

- **Search result**: One file's presence in the results, with its match count and, for content matches, the matching lines.
- **Snippet**: The rendered form of one matching line: truncated with ellipses and with the term highlighted.
- **Summary**: The aggregated "N matches in M files" figure derived from the per-file counts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find a file by a remembered content phrase and open it in under 5 seconds in a 500-file workspace.
- **SC-002**: A search producing thousands of matches renders the summary, sections, and snippets without perceptible lag.
- **SC-003**: Clearing a term returns a visually identical tree (same expansion, same selection).
- **SC-004**: No file or document is modified by a search, verified by byte-identical content before and after.
- **SC-005**: The badge count for a file equals the number of occurrences of the term in that file's contents.

## Assumptions

- The results view replaces the tree while a term is active; the tree is not modified during search, so clearing always restores it exactly (spec 057's snapshot/restore machinery becomes unnecessary).
- The tree's in-place filtering (react-arborist searchTerm) is no longer used; name matching for the results is computed from the loaded tree data, content matching from the workspace-wide scan, and the two lists are merged into the results view.
- "Filenames take precedence" means name matches always appear (badge 1) and are never hidden by content matches; a file matching both shows once.
- A name match is one "instance" in the summary; a content occurrence is one instance; the summary counts both across all matched files.
- Clicking a result opens the file; it does not scroll the editor to the matched line.
- While a search is active the tree is hidden, so tree operations (create/rename/move/delete) require clearing the search first.

## Clarifications

- 2026-09-05: The user chose the results list as a replacement for the tree while a term is active, click-to-open (no jump-to-line), and expanded-by-default file sections.
- 2026-09-05: This spec amends the presentation from specs 057 (name search) and 059 (content search); their search-input behaviour (live filtering, debounce, Escape/clear, empty state, reset-on-workspace-change) is preserved.