# Feature Specification: Reliable Source View Switching

**Feature Branch**: `spec-044-source-view-switching`

**Created**: 2026-08-24

**Status**: Archived

**Input**: User description (two related reports, consolidated by user direction): "There is a bug currently where if you add a new section in the visual editor (click in at the bottom of the document), then click code mode, the visual editor freezes. The only workaround is to press CTRL+S and close the tab. The bug happens when you just scroll down the page and click 'view source'." and "The visual editor should go to the caret position/vertical position of the document that the visual editor is on."

Terminology: "code mode" and "view source" refer to the source view; the WYSIWYG surface is the visual editor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opening the source view never hangs the editor (Priority: P1)

A user working in the visual editor activates view source under any conditions: after scrolling anywhere in the document, after clicking at the bottom of the document (which inserts a new empty section), or immediately after typing. The switch completes promptly every time, and both surfaces remain fully interactive afterwards. No workaround such as saving and closing the tab is ever needed.

**Why this priority**: The reported freeze makes the editor unusable without a save-and-reopen dance; restoring basic reliability is the core of this spec.

**Independent Test**: Script a session that clicks at the end of a document, immediately opens the source view, returns to the visual editor, and repeats; confirm every switch completes and the window responds to input throughout.

**Acceptance Scenarios**:

1. **Given** a document open in the visual editor with the view scrolled toward its end, **When** the user clicks in the empty area below the last content (creating a new section) and immediately activates view source, **Then** the source view opens promptly and the window remains responsive.
2. **Given** any document and scroll position, **When** the user activates view source, **Then** the switch completes without the visual editor freezing, hanging, or ignoring input afterwards.
3. **Given** the user alternates between visual and source view repeatedly on the same large document, **When** counting the work each switch performs, **Then** no switch is progressively slower than the first: repeated toggling must not accumulate per-toggle cost.

---

### User Story 2 - Recent edits are present when the source view opens (Priority: P1)

Text typed in the visual editor appears in the source text whenever the source view opens, no matter how briefly before the switch it was typed. The application's internal update timing must never cause a silent drop of characters the user can see they typed.

**Why this priority**: The same timing gap behind the freeze also silently discards the freshly inserted section; that is data loss, which this project treats as the most serious class of defect.

**Independent Test**: Type a distinctive string into the visual editor and activate view source within a second; confirm the string is present in the source text.

**Acceptance Scenarios**:

1. **Given** characters typed into the visual editor less than a second before activating view source, **When** the source view opens, **Then** those exact characters are present in the displayed source text.
2. **Given** a newly inserted empty section created by clicking at the document bottom immediately before switching, **When** the source view opens, **Then** the corresponding empty line exists in the source text rather than being silently absent.
3. **Given** a clean, untouched document, **When** the user opens the source view, **Then** the stored file content is shown unchanged, exactly as today.

---

### User Story 3 - Returning from the source view restores position (Priority: P2)

Switching back to the visual editor returns the user to where they were: the caret sits at the same offset and the pane shows the same vertical region as when they left, so alternating views feels like looking at one document through two windows rather than restarting each time.

**Why this priority**: This is the refinement that makes frequent switching pleasant; reliability (stories 1 and 2) must hold first.

**Independent Test**: Note the caret position and scroll offset in the visual editor, open the source view, return without editing, and confirm both are restored.

**Acceptance Scenarios**:

1. **Given** a caret offset and vertical scroll position in the visual editor, **When** the user opens the source view and returns without editing, **Then** the caret sits at the same offset and the pane displays the same scroll region as before.
2. **Given** the user edited the text while in the source view so the document length changed, **When** they return to the visual editor, **Then** the caret lands at the closest valid position to the previously stored offset (clamped to the new document), never defaulting to the document start merely because the content changed.
3. **Given** a restored caret that falls outside the visible area, **When** the visual editor reappears, **Then** the caret's neighbourhood is brought into view rather than leaving the selection invisible.

---

### Edge Cases

- A document whose final element is not a paragraph (heading, table, code block): clicking below it and switching must behave like any other switch, with the inserted section reflected in the source text.
- An empty or nearly empty document: switching in both directions completes normally and position restore degenerates gracefully (offset 0).
- Documents with frontmatter: the split between frontmatter and body is unaffected by switching; positions refer to the body presentation as today.
- Very large documents (10,000 lines): switch latency stays within the responsiveness expectations of the development principles, including with repeated toggling.
- Rapid repeated toggling, faster than internal update timers: no dropped edits, no wedged surface, no accumulating lag.
- Switching tabs while one tab is in source view and returning later: both tabs behave normally; each keeps its own context as today.
- Saving around a switch (before, during, after): dirty-state tracking and atomic saves behave exactly as specified elsewhere; the switch path must not corrupt or clear dirty flags.
- An internal error during a switch (for example from an unusual document structure): the failure leaves the previous usable editing surface in place and surfaces quietly instead of blanking the window or hanging it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Activating the source view MUST complete promptly regardless of the document's scroll position or how recently the user edited, and the visual editor MUST remain responsive afterwards. A state requiring the user to save and close the tab to recover MUST be impossible.
- **FR-002**: Alternating between views repeatedly MUST NOT accumulate per-toggle work; the Nth switch on the same document performs no more work than the first absent actual document changes.
- **FR-003**: All text entered in the visual editor before opening the source view MUST be present in the source text shown, regardless of how recently it was typed; no silent drop is permitted.
- **FR-004**: Returning to the visual editor from an unedited source view MUST restore the caret offset and vertical scroll position that were active when the source view was opened.
- **FR-005**: Returning to the visual editor after source edits changed the content MUST place the caret at the closest valid position to the previously stored offset, clamped to the new document bounds, and MUST NOT reset it to the start solely because the content changed.
- **FR-006**: If an error occurs during a view switch, the application MUST keep a usable editing surface, surface the problem as a quiet, actionable, in-context message, and MUST NOT hang, blank, or discard the document.
- **FR-007**: Existing behaviour is preserved: per-document source-view context persistence (its own selection and scroll), dirty-state tracking including live-dirty guards, atomic saves, and tab-switch context preservation are all unchanged by this feature except where explicitly stated above.

### Key Entities *(include if feature involves data)*

- **Visual editor position**: The pair of caret offset and vertical scroll offset captured for a document while its visual editor is active; restored when the visual editor regains the surface.
- **Source text**: The plain-text representation shown by the source view, derived from the same stored content the visual editor serialises to; both surfaces always resolve to identical bytes for an unedited round trip.
- **View mode**: Per-document formatted-or-source state, unchanged conceptually by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of scripted sessions that click at the document bottom and immediately open the source view, the switch completes, both surfaces respond to subsequent input, and zero sessions require a restart or tab close to recover.
- **SC-002**: Characters typed up to the moment of opening the source view appear in the source text in 100% of tests across small and large documents.
- **SC-003**: After 20 consecutive view switches on a 10,000-line document, the final switch completes with no progressive slowdown attributable to accumulated per-toggle work.
- **SC-004**: Unedited round trips restore the exact caret offset and scroll position in 100% of tests; round trips with source edits land the caret at a clamped valid offset, never at the document start unless the stored offset was at the start.

## Clarifications

### 2026-08-24 (user direction)

- **Consolidation**: The freeze report and the position-restore request are treated as one concern (reliable, comfortable view switching) in one spec; the freeze fix takes priority, restoration layers on top.

## Assumptions

- **Position meaning**: "Caret position/vertical position" means the caret offset plus the vertical scroll offset of the visual editor pane; approximate restoration via clamping is acceptable only when the document changed underneath the position.
- **Scope of fix**: The defect is analysed as renderer switching-flow behaviour (research.md); no new privileged operations or filesystem changes are expected, and existing security properties are untouched.
- **Scroll-down variant**: The "scroll down then view source" report is treated as the same defect class (switch-time work depending on recent unflushed edits), not a separate feature.
- **Verification honesty**: The freeze mechanism is established by code analysis; implementation tasks must include reproduction scripts demonstrating both the pre-fix failure and the post-fix pass.
