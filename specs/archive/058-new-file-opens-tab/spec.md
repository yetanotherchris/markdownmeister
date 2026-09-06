# Feature Specification: New Explorer File Opens in a Tab

**Feature Branch**: `058-new-file-opens-tab`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "when creating a new file in the file explorer, it opens that file in a new tab"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Created file opens immediately (Priority: P1)

A user creates a new file from the file explorer's New File action, types its name into the naming input, and confirms. Today the file then just sits in the tree and the user must open it as a second step. Instead, the moment the name is confirmed, the file opens in a new tab and that tab becomes active, showing the empty document, ready to type into.

**Why this priority**: This is the entire feature: removing the second, manual step between creating a file and writing in it.

**Independent Test**: Create a file through the explorer, confirm the name, and observe a new active tab showing that empty file without any further action.

**Acceptance Scenarios**:

1. **Given** a workspace is open, **When** the user creates a file via the explorer's New File action and confirms the name, **Then** the file opens in a new tab and that tab becomes active.
2. **Given** a newly created file has just opened in a tab, **When** the user looks at the document, **Then** it is empty and the tab is not marked as containing unsaved changes.
3. **Given** the file was created inside a subfolder, **When** the name is confirmed, **Then** the correct file from that subfolder is opened.
4. **Given** the creation and naming flow completes, **When** the new tab is active, **Then** the file also appears in the explorer tree as it does today.

---

### User Story 2 - Cancellation opens nothing (Priority: P2)

If the user abandons the creation (cancels the naming input or leaves it without confirming), no tab opens. The existing cancellation behaviour is preserved: no placeholder file is left behind, and the tab bar and tree are exactly as they were.

**Why this priority**: Abandoned creations opening empty tabs would litter the session and betray the confirmation step; this is the safety half of the feature.

**Independent Test**: Start creating a file, cancel the naming input, and confirm no tab opened, no placeholder file remains, and the tree and tab bar are unchanged.

**Acceptance Scenarios**:

1. **Given** the naming input is open for a new file, **When** the user cancels it, **Then** no tab opens and no placeholder file is left on disk.
2. **Given** the naming input is open for a new file, **When** the user confirms an invalid name and the input rejects it, **Then** no tab opens; the tab opens only after a name is accepted.
3. **Given** the user cancels or fails a creation, **When** they look at the tab bar and tree, **Then** both are exactly as they were before the creation started.

---

### User Story 3 - Nothing else changes (Priority: P3)

The feature changes only what happens after a successful file creation. Folder creation never opens a tab. Existing tabs, including tabs with unsaved changes, are never displaced or altered by a creation elsewhere. Reopening an already-open file keeps focusing its existing tab rather than duplicating it.

**Why this priority**: These are guard rails rather than new behaviour, but they define the boundary of the change and protect unsaved work.

**Independent Test**: With a dirty tab active, create a file in the explorer and confirm the dirty tab still holds its unsaved changes, the new tab is active, and switching back shows the edits intact.

**Acceptance Scenarios**:

1. **Given** a tab with unsaved changes is active, **When** the user creates a new file in the explorer, **Then** the new file opens in a new active tab and the previously active tab keeps its unsaved changes.
2. **Given** the user creates a new folder via the explorer, **When** the name is confirmed, **Then** no tab opens.
3. **Given** a tab is already open for a file, **When** a creation flow results in that same file path, **Then** the existing tab is focused instead of a duplicate tab being opened.
4. **Given** any other way of opening files (double-click in the tree, the open dialog, reopening a recent file), **When** files are opened, **Then** their behaviour is unchanged by this feature.

---

### Edge Cases

- What happens when the workspace has no tabs open yet? The created file becomes the first tab.
- What happens when the committed name collides with an existing file in the same folder? The existing name validation still applies; nothing opens unless the creation itself succeeds.
- What happens when the user creates several files in quick succession? Each confirmed creation opens its own tab; the most recently created is active.
- What happens when the new-file creation fails on disk? No tab opens; the existing error surfacing for failed creation is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the user confirms the name of a newly created file in the explorer, the application MUST open that file in a new tab and make that tab active.
- **FR-002**: The opened document MUST reflect the file as it exists on disk at open time, and the new tab MUST NOT be marked as containing unsaved changes.
- **FR-003**: If a tab for the created file's path is already open, the application MUST focus that tab instead of opening a duplicate.
- **FR-004**: A cancelled or failed creation MUST NOT open a tab and MUST leave the tab bar and tree unchanged from before the creation started.
- **FR-005**: The creation flow itself MUST NOT change: same entry point, same naming validation, same cancellation behaviour, same on-disk result.
- **FR-006**: Creating a folder MUST NOT open a tab.
- **FR-007**: Existing tabs MUST NOT be displaced, closed, or altered by a file creation; a tab with unsaved changes MUST keep them.
- **FR-008**: The untitled-document flow (new document from the tab bar or menu) MUST be unchanged by this feature.

### Key Entities *(include if feature involves data)*

- **Created file**: A file created through the explorer's New File action, identified by its final confirmed path inside the workspace.
- **New tab**: A document tab showing the created file. No new persistence, settings, or stored entities are introduced by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the New File action to typing in the new document takes one naming step, with no separate open action required.
- **SC-002**: A cancelled creation leaves the session exactly as it was: no new tab, no leftover file.
- **SC-003**: Repeated creation and opening never produces duplicate tabs for the same file path.
- **SC-004**: Unsaved changes in other tabs survive every creation flow untouched.

## Assumptions

- "Confirming the name" means completing the inline naming input that the explorer's New File action opens; the confirmation gesture (Enter) is whatever the current flow uses.
- "New tab" is forced for this flow regardless of any open-behaviour preference, because a just-created empty file must never displace an active document.
- The feature applies to the explorer's New File flow only; the separate untitled-document flow and all other open paths are out of scope.
