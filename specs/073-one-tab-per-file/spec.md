# Feature Specification: One Tab Per File

**Feature Branch**: `spec-073-one-tab-per-file`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "A file is always represented by one tab, however and in whatever order it was opened, including files opened before their folder, files opened through the explorer, and case-variant paths on a case-insensitive filesystem."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - File opened before its folder (Priority: P1)

A person opens a file with no folder open and edits it. They then open the folder that contains the file and click the file in the explorer. The existing tab is brought forward, no second tab appears, and the unsaved text is unchanged. The same outcome holds when the second open is the Open File command after the folder is open.

**Why this priority**: This is the reported case where a second tab for the same file can silently overwrite the first tab's edits when either tab is saved. It causes unsaved work to be lost, so it comes first.

**Independent Test**: With no folder open, open a file, type into it, open its containing folder, click the file in the explorer, and confirm there is one tab, it is active, and the typed text is still there. Repeat the second open with the Open File command.

**Acceptance Scenarios**:

1. **Given** a file opened with no folder and unsaved edits, **When** the user opens its containing folder and clicks the file in the explorer, **Then** the existing tab is activated, no second tab appears, and the unsaved text is unchanged.
2. **Given** a file opened with no folder and unsaved edits, **When** the user opens its containing folder and then opens the same file with Open File, **Then** one tab exists, it is activated, and the unsaved text is unchanged.

---

### User Story 2 - Same file, any route (Priority: P1)

A person opens a file and later opens the same file again through the menu, the explorer, an operating-system open, or a recent-items entry. One tab exists for the file, and opening it again never changes its unsaved content.

**Why this priority**: Any route that produces a second tab reopens the same silent overwrite, so every supported route must agree on what counts as the same file.

**Independent Test**: Open a file, type into it, then open it again through each route in turn. After each attempt, confirm one tab exists, it is active, and the typed text is unchanged. As a separate check, open two different files that share a name in different folders and confirm they stay in separate tabs with independent saves.

**Acceptance Scenarios**:

1. **Given** a file opened from the explorer with unsaved edits, **When** the same file is opened with Open File or from a recent-items entry, **Then** one tab exists, it is activated, and the unsaved text is unchanged.
2. **Given** a file with unsaved edits, **When** the same file is opened by an operating-system open, through a symlink path, through a path containing `..`, or by repeating the operating-system open, **Then** one tab exists, it is activated, and the unsaved text is unchanged.
3. **Given** two different files that share a name or a relative path in different folders, **When** each is opened, **Then** two tabs exist and saving each tab writes only its own file.
4. **Given** a file open from folder `dir`, **When** the user opens `dir`'s parent folder and opens the same file through the route `dir/a.md`, **Then** one tab exists, it is activated, its unsaved text is unchanged, and saving it writes `dir/a.md` rather than a file named `a.md` at the new root.

---

### User Story 3 - Case-variant path on a case-insensitive filesystem (Priority: P2)

On a filesystem that ignores letter case in names, `a.md` and `A.md` name one file, so they are one tab. On a filesystem that distinguishes letter case, they may be two different files, so they may be two tabs.

**Why this priority**: This is the same overwrite as the first story, but it needs a differently cased path to the same file, which is less common. It must follow what the filesystem reports rather than a fixed rule about letter case.

**Independent Test**: On a case-insensitive filesystem, open a file, type into it, then open the same file with different letter case in its path. Confirm one tab exists and the typed text is unchanged. On a case-sensitive filesystem, create two files whose names differ only in letter case and confirm they open in two tabs.

**Acceptance Scenarios**:

1. **Given** a file opened with unsaved edits using one letter case, **When** the same file is opened with a different letter case on a case-insensitive filesystem, **Then** one tab exists, it is activated, and the unsaved text is unchanged.
2. **Given** two genuinely different files whose names differ only in letter case on a case-sensitive filesystem, **When** each is opened, **Then** two tabs exist and saving each writes only its own file.

---

### Edge Cases

- Recent-items entries that supply a case-variant path of an open file.
- Drive-letter case and path separators on a system that accepts more than one spelling of the same path.
- A symlink path and a path containing `..` that resolve to an already-open file.
- A file opened through its containing folder and later through a path outside that folder that resolves to the same file.
- A file whose containing folder is opened only after the file, including when the second open is the menu command.
- A file accessed through two different routes where the second route cannot be resolved to the same file; the existing behavior applies and the file may open separately.
- Save As changes which file a tab represents. After a completed Save As, the tab represents the chosen file, and opening that chosen file follows the same one-tab rule.
- A file deleted or renamed outside the app while open. This is outside this feature but must not crash the app or change the one-tab rule for the remaining open files.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each file MUST have at most one open tab, whatever route and whatever order opened it.
- **FR-002**: Two paths MUST be treated as the same file when the filesystem reports that they name the same file. On a case-insensitive filesystem, paths that differ only in letter case MUST be treated as one file. On a case-sensitive filesystem, paths that differ in letter case MAY be different files.
- **FR-003**: Opening an already-open file MUST activate its existing tab, MUST NOT create a second tab, and MUST NOT change that tab's unsaved content.
- **FR-004**: A tab MUST NOT be activated for a different file that merely shares a name or a relative path. Two files with the same name or relative path in different folders MUST keep separate tabs and MUST save independently.
- **FR-005**: FR-001 to FR-004 MUST apply to the menu open command, the explorer, operating-system opens, and recent-items entries.
- **FR-006**: A deterministic symlink path or a path containing `..` that resolves to an already-open file MUST activate that file's existing tab.
- **FR-007**: Opening an already-open file MUST NOT present a new prompt, confirmation, or message. This feature MUST NOT add any new user-visible prompt or confirmation.
- **FR-008**: Opening a file that is not already open MUST keep its current behavior, including the existing rule from spec 024 that opening a different file from the explorer may replace a clean active tab.
- **FR-009**: When an already-open file is reached through a different workspace-relative route under the current workspace root, the activated tab MUST adopt that route and the file's current name so a save writes the file the tab represents. Its unsaved content, dirty state, and undo history MUST NOT change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every route and order covered by the acceptance scenarios, the file has exactly one tab and its unsaved text is unchanged.
- **SC-002**: Two files that share a name or relative path in different folders keep two tabs, and each save writes only the file belonging to its tab.
- **SC-003**: On a case-sensitive filesystem, two genuinely different files whose names differ only in letter case remain in separate tabs.
- **SC-004**: On a case-insensitive filesystem, every route that supplies a case-variant path of an open file activates the existing tab instead of adding one.
- **SC-005**: Existing tab, open, and save tests continue to pass with no change in their expected outcomes.
- **SC-006**: The covered routes add zero new prompts or confirmations.

## Assumptions

- Same-file identity follows the filesystem, as decided in the exploratory report's Q4.
- The operating system permits opening a file through any of these routes without warning.
- Recent-items and operating-system open routes are in scope even though some combinations were not exercised in the original exploration.
- The existing rule that opening a different file from the explorer may replace a clean active tab (spec 024) is unchanged.
- No user-visible indication of file identity is required. Tabs continue to show their existing titles and unsaved markers.
- Folder-switch tab lifecycle (report finding F2, spec B) is a separate feature: opening a folder does not close or rebind open tabs. Rebinding happens when the same file is next opened through a route under the current root (FR-009).
- Save after an external rename or delete (report finding F4, spec C) is a separate feature and out of scope.
- Save As onto a file that is already open in another tab is out of scope and may leave two tabs until a later change. This feature does not merge them.
- Any other change to save, Save As, close, or quit behavior is out of scope. A document that has never been saved has no file, so the one-tab rule does not apply to it.
