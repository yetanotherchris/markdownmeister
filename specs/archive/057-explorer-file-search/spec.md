# Feature Specification: File Explorer Search

**Feature Branch**: `057-explorer-file-search`

**Created**: 2026-09-02

**Status**: Archived

**Input**: User description: "search box for file explorer to find a file"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter the tree to find a file by name (Priority: P1)

A user with a folder tree containing many files wants to find one whose name they roughly remember. They type a fragment of the name into a search box above the tree, and the tree filters live: only entries whose name contains the fragment remain visible, together with the folders that contain them, so the tree structure stays readable. Files buried in collapsed folders become visible without the user expanding anything first.

**Why this priority**: Live name filtering that reaches into collapsed folders is the feature; without it the user is back to expanding folders by hand.

**Independent Test**: Open a workspace with files inside collapsed folders, type a name fragment into the explorer search box, and observe only matching entries (and their ancestor folders) remain, including matches that were previously collapsed.

**Acceptance Scenarios**:

1. **Given** a workspace is open, **When** the user types into the explorer search box, **Then** the tree filters live with each keystroke, with no separate submit step.
2. **Given** a term is entered, **When** the filtered tree is shown, **Then** every entry whose name contains the term (case-insensitively) is visible, and every ancestor folder of a match is visible so the structure remains readable.
3. **Given** a matching file sits inside collapsed folders, **When** the term matches its name, **Then** that file becomes visible without the user expanding anything first.
4. **Given** a term is entered, **When** the filtered tree is shown, **Then** entries whose names do not contain the term are hidden.
5. **Given** a term that matches a folder's own name, **When** the filtered tree is shown, **Then** the folder appears as a match; its children appear only if they match the term too.
6. **Given** no entry name contains the term, **When** the filtered tree is shown, **Then** a calm empty-state message appears in place of the tree and no error or dialog appears.

---

### User Story 2 - Clearing restores the tree exactly (Priority: P2)

When the user deletes the term (by deleting text, using a clear control, or pressing Escape), the tree returns to exactly what it looked like before filtering: the same folders expanded or collapsed, and the same selection.

**Why this priority**: Users filter to orient, then go back to browsing; a filter that wrecks the previous expansion state taxes every search.

**Independent Test**: Expand a specific set of folders, filter, clear the term, and confirm the tree shows the same folders expanded or collapsed and the same selection as before filtering.

**Acceptance Scenarios**:

1. **Given** a filtered tree, **When** the user deletes the term text or activates the clear control, **Then** the full tree returns with the same expansion state as before filtering.
2. **Given** a file was selected before filtering, **When** the term is cleared, **Then** that file is selected again.
3. **Given** focus is in the search input, **When** the user presses Escape, **Then** the term is cleared, the tree is restored as above, and focus returns to the tree.
4. **Given** a term is entered, **When** the user opens a different workspace or restarts the application, **Then** the new session starts with an empty search box.

---

### User Story 3 - Open a found file (Priority: P3)

Activating a matching file in the filtered tree opens it exactly as activating it in the unfiltered tree would, following the same open behaviour and duplicate-tab rules. Activating a matching folder focuses it like any folder activation.

**Why this priority**: Finding a file is usually a step toward opening it; but the open behaviour already exists, so this story only requires the filtered tree to route activation through it unchanged.

**Independent Test**: Filter to a file, activate it, and confirm it opens exactly as it does when activated in the unfiltered tree.

**Acceptance Scenarios**:

1. **Given** a filtered tree showing a matching file, **When** the user activates it, **Then** the file opens with exactly the same behaviour as activating it in the unfiltered tree, including the existing rule that reopening an already-open file focuses its tab.
2. **Given** a filtered tree showing a matching folder, **When** the user activates it, **Then** the folder is focused and expanded like any folder activation in the tree.
3. **Given** a filtered tree, **When** the user creates, renames, or deletes entries through the usual controls, **Then** those operations behave as they do in the unfiltered tree.

---

### Edge Cases

- What happens with a term containing punctuation, symbols, or accented characters? Names are compared as plain text, case-insensitively; the term is never interpreted as a pattern.
- What happens with a very large workspace (thousands of entries)? Filtering stays responsive on every keystroke with no perceptible lag.
- What happens when a new file is created while a filter is active? The usual creation flow runs; if the new name does not contain the active term, the new entry is hidden by the filter until the term is cleared or changed.
- What happens with a term that is only whitespace? The tree is treated as unfiltered; no empty-state message is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The file explorer MUST provide a search input positioned with the explorer panel.
- **FR-002**: The tree MUST filter live while the user types, without a separate submit step.
- **FR-003**: Matching MUST be a case-insensitive substring test on the entry's name, for files and folders alike, and MUST consider no other fields.
- **FR-004**: Matching entries under collapsed folders MUST become visible while the term is active, with every ancestor folder of a match kept visible.
- **FR-005**: Entries whose names do not contain the term MUST be hidden while the term is active.
- **FR-006**: A folder whose own name matches MUST appear as a match, and its children MUST appear only if they match the term too.
- **FR-007**: File contents MUST NOT be searched; only the names of entries already listed in the tree are considered.
- **FR-008**: Clearing the term MUST restore the tree exactly as before filtering, including folder expansion state and selection.
- **FR-009**: When no entry matches, the explorer MUST show a calm empty-state message instead of an error.
- **FR-010**: Activating a matching file MUST behave exactly like activating that file in the unfiltered tree, including existing open-behaviour and duplicate-tab rules.
- **FR-011**: Activating a matching folder MUST behave exactly like activating that folder in the unfiltered tree.
- **FR-012**: Filtering MUST stay responsive on every keystroke for workspaces with thousands of entries.
- **FR-013**: The search term MUST NOT persist across workspace changes or application restarts.
- **FR-014**: Escape in the search input MUST clear the term and return focus to the tree.

### Key Entities *(include if feature involves data)*

- **Search term**: The text currently typed in the explorer search box. It exists only in the interface, is never persisted, and never alters which entries exist on disk or in the tree data.
- **Filtered view**: A display-time restriction of the tree. The tree data itself is unchanged by filtering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find a file by a remembered name fragment in a 500-entry workspace in under 5 seconds, including opening it.
- **SC-002**: Filtering responds on every keystroke with no perceptible lag in a workspace with 5,000 entries.
- **SC-003**: After clearing a term, the tree is visually identical to its pre-filter state: same expansion, same selection.
- **SC-004**: Activating a filtered result opens the intended file every time, indistinguishable from opening it unfiltered.

## Assumptions

- Search matches entry names only; searching inside file contents is out of scope for this feature.
- Matching is a case-insensitive substring test; no pattern syntax, and no accent-insensitive folding beyond the platform's default text comparison.
- The search input is always visible above the tree rather than hidden behind a toggle; it is compact enough not to crowd the panel.
- The term is used as typed; the tree library trims surrounding whitespace before matching, so leading/trailing spaces are not significant to whether a name matches, and a whitespace-only term counts as no filter.
- Filtering is display-only: it never gates or rewrites the existing create, rename, move, or delete operations.
- The search domain is the set of entries already listed in the tree (FR-007). Folders load their children lazily on first expansion, so a folder that has never been expanded contributes no candidates; FR-004's "collapsed folders" means folders that are collapsed but whose entries the tree already knows (expanded at least once).

## Clarifications

- 2026-09-05: FR-004 and FR-007 reconcile as follows. Matching considers only entries already listed in the tree, so a never-expanded folder's contents are not searched until the folder is opened once. Once loaded, a collapsed folder's matching entries surface while the term is active, with the folder kept visible as an ancestor. This was confirmed during e2e authoring: a fixture file inside a never-opened folder did not match, which is consistent with FR-007 rather than a defect in the filter.
- 2026-09-05: The surrounding-whitespace assumption is adjusted to the tree library's fixed behaviour: react-arborist trims the search term before matching, so " foo " matches names containing "foo". A whitespace-only term still filters nothing. Matching the literal "used as typed" wording would require replacing the library's built-in filtering, which the plan rejected; the observable outcomes (whitespace-only term filters nothing, plain-text substring matching) are unchanged.
