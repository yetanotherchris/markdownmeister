# Feature Specification: Double-Click Open in New Tab

**Feature Branch**: `029-double-click-new-tab`

**Created**: 2026-08-10

**Status**: Archived

**Input**: User description: "This spec is to add the feature where double clicking a file will open it in a new tab. This should only happen if the 'open in new tab' setting is disabled."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same-tab users pin a file to its own tab (Priority: P1)

A writer who prefers to browse files in a single tab (the "Open explorer files in a new tab" setting is off) can double-click a file in the explorer to open it in its own tab, leaving the current tab and its content untouched. This gives them a quick, discoverable way to keep one file open while browsing, without changing their setting.

**Why this priority**: This is the core requested behaviour. Without it, writers who browse in a single tab have no discoverable gesture to open a particular file in its own tab — their only options are to change the setting or remember the less-discoverable explicit new-tab action.

**Independent Test**: With the "Open explorer files in a new tab" setting disabled and a clean document active, double-click a different file in the explorer. Verify the file opens in a NEW tab, the previously active tab remains open with its original content, and no tab was replaced.

**Acceptance Scenarios**:

1. **Given** the "Open explorer files in a new tab" setting is disabled and a clean tab shows a saved file, **When** the user double-clicks a different file in the explorer, **Then** the double-clicked file opens in a new tab and the previously active tab stays open with its original content unchanged.
2. **Given** the setting is disabled and the active tab is dirty, **When** the user double-clicks a file in the explorer, **Then** the file opens in a new tab and the dirty tab is untouched.
3. **Given** the setting is disabled and no tabs are open, **When** the user double-clicks a file, **Then** a single new tab for that file opens.
4. **Given** the setting is disabled and a clean tab shows an untitled (never-saved) document, **When** the user double-clicks a file, **Then** the file opens in a new tab and the untitled tab remains open.
5. **Given** the setting is disabled, **When** the user double-clicks a file that is already open in another tab, **Then** the existing tab for that file is activated and no duplicate tab is created.

---

### User Story 2 - New-tab users see no change (Priority: P2)

A writer who has enabled "Open explorer files in a new tab" opens files exactly as before. Double-clicking does not create duplicates or unexpected extra tabs.

**Why this priority**: The feature must be additive. Users who already get a new tab from a single click must not be surprised by a double-click creating a different or duplicate result.

**Independent Test**: With the setting enabled, single-click a file, then double-click another file. Verify each open produces exactly one new tab and no duplicate tab is created.

**Acceptance Scenarios**:

1. **Given** the "Open explorer files in a new tab" setting is enabled, **When** the user double-clicks a file in the explorer, **Then** the file opens in a new tab, the same outcome as a single-click, and no duplicate tab is created.
2. **Given** the setting is enabled and the double-clicked file is already open, **When** the user double-clicks it, **Then** the existing tab is activated and no duplicate is created.

---

### User Story 3 - Directories keep their current behaviour (Priority: P2)

A writer double-clicking a folder expands or collapses it exactly as today; no document tab is opened.

**Why this priority**: Only files open as documents. Preserving folder behaviour avoids confusing a structural action (expand/collapse) with an open action.

**Independent Test**: Collapse a directory, double-click it, and verify it expands without opening a tab; repeat for collapsing an expanded directory.

**Acceptance Scenarios**:

1. **Given** a collapsed directory, **When** the user double-clicks it, **Then** the directory expands and no document tab is opened.
2. **Given** an expanded directory, **When** the user double-clicks it, **Then** the directory collapses and no document tab is opened.

---

### Edge Cases

- A double-click is composed of two clicks: the first click MUST NOT apply the setting's same-tab replacement behaviour before the double-click's new-tab behaviour takes effect, or the previous tab would already be replaced and the double-click would only activate the newly replaced tab, defeating the feature.
- Two deliberate single clicks on a file that are not recognised as a double-click: each follows the single-click preference behaviour (replace a clean tab in same-tab mode).
- Double-click on an already-open file activates the existing tab; no duplicate is created.
- Double-click on a directory expands or collapses it and never opens a document tab.
- Double-click when no tab is open opens the file in a single new tab.
- The double-clicked file fails to read (for example it was moved or deleted): the existing quiet failure behaviour applies — a footer note is shown and no tab is created.
- The setting is changed while a double-click is in flight: the decision uses the setting value at the time the gesture completes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the "Open explorer files in a new tab" setting is disabled, double-clicking a file in the explorer MUST open that file in a new tab.
- **FR-002**: The double-click new-tab behaviour MUST leave the previously active tab and its content unchanged.
- **FR-003**: The two clicks of a double-click MUST be treated as a single gesture: the first click MUST NOT replace or otherwise alter the active tab as a single-click would before the double-click behaviour takes effect.
- **FR-004**: When the setting is enabled, double-clicking a file MUST produce the same tab outcome as opening it with a single click (a new tab), and MUST NOT create a duplicate tab.
- **FR-005**: Double-clicking a file that is already open in a tab MUST activate the existing tab without creating a duplicate.
- **FR-006**: Double-clicking a directory MUST retain its existing expand/collapse behaviour and MUST NOT open a document tab.
- **FR-007**: Single-click file-opening behaviour MUST be unchanged: with the setting disabled a single click replaces a clean active tab; with the setting enabled it opens a new tab.
- **FR-008**: When no tab is open, double-clicking a file MUST open it in a new tab.
- **FR-009**: The double-click new-tab behaviour MUST NOT replace, close, or discard a dirty tab.

### Key Entities

- **File-opening gesture**: How a user opens a file from the explorer — a single click (follows the setting), a double click (this feature), or an explicit new-tab action such as middle-click.
- **File-opening preference**: The "Open explorer files in a new tab" setting. When disabled, a single click replaces a clean active tab; when enabled, a single click always opens a new tab.
- **Tab replacement**: Replacing the active tab's document with another file's content, discarding the replaced tab's undo history as per the existing replace-clean-tab behaviour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tests with the setting disabled, double-clicking a file produces exactly one new tab for that file and the previously active tab remains open with its original content.
- **SC-002**: In 100% of tests, single-click behaviour is unchanged in both setting states (no regression to the file-opening preference).
- **SC-003**: In 100% of tests with the setting enabled, double-clicking a file produces the same tab result as a single-click, with no duplicate tabs.
- **SC-004**: In 100% of tests, double-clicking an already-open file activates the existing tab without creating a duplicate.
- **SC-005**: In 100% of tests, double-clicking a directory expands or collapses it and never opens a document tab.

## Clarifications

- **2026-08-10**: US3/FR-006 state directories expand/collapse on double-click "exactly as today", but today a directory double-click does nothing (the row's `node.activate()` is a no-op for directories). The acceptance scenarios and SC-005 are authoritative: this feature **adds** directory double-click → expand/collapse (and never opens a tab).
- **2026-08-10**: The single-click deferral window is fixed at **500 ms** (the Windows OS double-click time). This is the minimum window that guarantees the browser's `dblclick` (detail=2) always lands before the deferred single-click open commits (FR-003); shorter windows would let a slow double-click replace the tab before the new-tab behaviour fires.
- **2026-08-21 (AMENDMENT — deferral removed)**: After spec 033 made editor mounts fast (25–55 ms), measurement showed the 500 ms deferral was the entire perceived cost of a same-tab open (560–600 ms perceived vs ~100 ms for a double-click). Per user decision, the deferral window and its pending-open machinery were **removed**: every file open commits immediately. A double-click's second request remains an explicit new-tab open, but the reducer's already-open dedupe lands it on the tab the first click just presented. Consequences, accepted by the user: over a CLEAN active tab a double-click now replaces that tab instead of pinning a separate one (FR-001/SC-001 amended); over a dirty active tab, with no tabs, under the new-tab preference, and for already-open files the outcomes are unchanged (FR-002/005/007/008/009 hold). Directory behaviour is unchanged (FR-006).

## Assumptions

- **Scope**: The feature applies only to file nodes in the explorer. Directories keep their current double-click behaviour (expand/collapse).
- **Dedupe priority**: The already-open dedupe rule takes priority over the double-click new-tab behaviour, matching the existing explicit new-tab action (middle-click).
- **Enabled setting needs no distinct handling**: When "Open explorer files in a new tab" is enabled, a single click already opens a new tab and dedupe prevents duplicates, so the double-click needs no special handling. The "only when disabled" condition is therefore naturally satisfied.
- **Double-click detection**: Because a double-click is delivered as two clicks followed by the double-click event, distinguishing it from two single clicks requires the single-click open action to be briefly deferred (by the double-click window) and then either committed when no second click arrives or replaced by the new-tab behaviour when a double-click lands. The exact mechanism and delay are planning decisions; any delay must be short enough that single-click browsing still feels immediate (the double-click window is a few hundred milliseconds).
- **Setting timing**: The file-open preference decision uses the setting value at the time the gesture completes.
