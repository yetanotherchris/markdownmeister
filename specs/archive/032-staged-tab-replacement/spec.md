# Feature Specification: Staged Same-Tab Replacement

**Feature Branch**: `phase-32-staged-replacement`

**Created**: 2026-08-16

**Status**: Archived

**Input**: User description: "Same-tab file opens leave the visual editor blank for about one second while Milkdown initializes."

## User Scenarios & Testing

### User Story 1 - Browse files without an empty editor (Priority: P1)

A writer opens another file into a clean active tab and continues seeing the current document until the new visual editor is ready. The tab then changes once, with the new title and content visible together; the editor never presents an empty or unusable canvas during the transition.

**Independent Test**: Open a clean document, open another file in the same tab, and verify a visible editor remains throughout the transition before the destination title and content appear atomically.

**Acceptance Scenarios**:

1. **Given** a clean active formatted document, **When** the writer opens another file using the current-tab behavior, **Then** the outgoing visual editor remains visible and non-empty until the incoming visual editor is ready.
2. **Given** an incoming replacement editor becomes ready, **When** the replacement commits, **Then** the tab title, path, content, and active editor change together and the incoming document starts with a fresh undo history and clean dirty state.
3. **Given** the incoming replacement editor is still initializing, **When** the writer makes the outgoing document dirty, **Then** the replacement is cancelled and the writer's changes remain open and protected.

### User Story 2 - Preserve existing tab and data-loss behavior (Priority: P1)

A writer retains all existing open-file behavior: dirty tabs open a new tab, explicit new-tab actions open a new tab, existing tabs are activated, and source-view edits are never overwritten by a staged replacement.

**Independent Test**: Start a staged replacement, edit the outgoing formatted and source documents before completion, and verify the replacement does not discard either edit.

**Acceptance Scenarios**:

1. **Given** an active document is dirty, **When** a file is opened, **Then** a new tab opens as before without staging a replacement.
2. **Given** an outgoing source-view document receives an edit while a replacement is staged, **When** the incoming editor becomes ready, **Then** the replacement is cancelled and existing unsaved-change confirmation remains available.
3. **Given** a second file-open request occurs while a replacement is staged, **When** it targets the same tab, **Then** the obsolete staged replacement is cancelled and only the latest valid request may replace the tab.

## Requirements

- **FR-001**: Same-tab replacement MUST keep the outgoing formatted editor visible until the incoming formatted editor has initialized.
- **FR-002**: The incoming editor MUST remain invisible, non-interactive, and unable to steal focus until replacement commits.
- **FR-003**: Replacement MUST commit atomically: outgoing tab identity is replaced by a fresh incoming document identity only after incoming initialization completes.
- **FR-004**: Immediately before committing, the application MUST re-evaluate the outgoing document's live dirty state; if dirty, it MUST cancel replacement without discarding text.
- **FR-005**: Source-view edits, including edits not yet represented in the visual editor, MUST cancel a staged replacement and preserve existing close and quit protections.
- **FR-006**: Explicit new-tab opens, dirty-tab opens, and activation of an already-open file MUST preserve their existing behavior and MUST NOT stage an unnecessary replacement.
- **FR-007**: A superseded or closed outgoing tab MUST cancel and destroy its staged incoming editor without changing document state.
- **FR-008**: The feature MUST NOT add filesystem access, IPC operations, preload API operations, or change save semantics.
- **FR-009**: Temporary staged editors MUST be bounded and released after commit or cancellation; normal editor-pool behavior resumes immediately.

## Success Criteria

- **SC-001**: Automated end-to-end testing observes a visible formatted editor throughout 100% of tested same-tab replacements.
- **SC-002**: Automated tests verify 100% of edits made during staged formatted or source replacements are retained and receive existing unsaved-change protection.
- **SC-003**: Automated tests verify a completed replacement presents the incoming title and content together with a clean dirty state and new undo history.
- **SC-004**: In normal same-tab browsing, the old editor remains responsive until the new editor is ready and no empty editor canvas is shown.

## Assumptions

- The replacement may complete asynchronously; the outgoing clean document remains visible until the ready incoming editor can safely replace it.
- Only one staged replacement may target a tab at a time.
- The existing visual-editor initialization cost is accepted; this feature removes its disruptive empty-canvas transition rather than changing Milkdown's parser or document model.
