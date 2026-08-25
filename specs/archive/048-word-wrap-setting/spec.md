# Feature Specification: Source View Word Wrap Setting

**Feature Branch**: `spec-048-word-wrap-setting`

**Created**: 2026-08-24

**Status**: Archived

**Input**: User description: "add 'wordwrap enable/disable' under settings/markdown and view source."

Interpretation note: the setting lives in the Markdown area of settings and controls word wrap in the source view (the plain-text editing surface); see Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The user chooses whether long lines wrap in the source view (Priority: P1)

A user editing a document with long lines opens Settings, Markdown, and finds a Word Wrap control. Off (the default) preserves today's behaviour: lines run past the pane edge and horizontal scrolling reveals them. On: long lines continue on the next visual line within the pane, so nothing needs horizontal scrolling to read. The choice applies to every source view immediately and survives restarts.

**Why this priority**: The toggle with immediate effect and correct default is the whole feature.

**Independent Test**: Open a document containing a line far wider than the pane, enter the source view, confirm horizontal overflow exists; enable Word Wrap in settings and confirm the same line now wraps inside the pane without restarting or reopening the tab.

**Acceptance Scenarios**:

1. **Given** the settings dialog's Markdown area, **When** inspected, **Then** a Word Wrap control with exactly two states exists alongside the other Markdown-area controls.
2. **Given** wrap disabled, **When** the source view shows a line wider than the pane, **Then** the line extends beyond the pane edge and horizontal scrolling reaches the rest, matching today's behaviour.
3. **Given** wrap enabled, **When** the source view shows the same content, **Then** long lines continue within the pane instead of requiring horizontal scrolling.
4. **Given** either state chosen, **When** an already-open source view is visible, **Then** the change takes effect immediately without closing or reopening it.

---

### User Story 2 - Toggling is safe mid-editing (Priority: P1)

Switching wrap on or off while a document is open in the source view never loses text, selection, or dirty state, and does not disorient the caret: after toggling, the user can continue typing exactly where they were.

**Why this priority**: The source view is a live editing surface; a presentation change that disturbed editing state would violate the project's calm-editing principles.

**Independent Test**: With unsaved edits and a selection in the source view, toggle wrap both ways and confirm the text, selection anchors, dirty indicator, and caret context are intact and typing continues normally.

**Acceptance Scenarios**:

1. **Given** unsaved edits in the source view, **When** wrap is toggled, **Then** the edited text and the tab's dirty state are unchanged.
2. **Given** a selection spanning wrapped or unwrapped lines, **When** wrap is toggled, **Then** the selection continues to cover the same characters.
3. **Given** the caret positioned mid-document, **When** wrap is toggled, **Then** subsequent typing inserts at the intended position.

---

### Edge Cases

- Very long unbroken tokens (URLs, minified content) with wrap enabled: they break within the pane rather than forcing horizontal scrolling.
- Extremely wide single lines with wrap disabled: unchanged from today (horizontal scroll).
- Toggling while scrolled far to the right: the view adjusts sanely without errors; with wrap on, horizontal offset becomes meaningless and resets.
- Documents with frontmatter: wrapping applies uniformly; no special-casing.
- Multiple tabs: the preference applies to every source view uniformly, current and future.
- Very large documents with wrap enabled: typing latency must remain imperceptible per the development principles (verification included in testing).
- Malformed stored value for the preference: rejected by trusted-process validation; default applies quietly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Markdown settings area MUST offer a word wrap control for the source view with exactly two states: enabled and disabled.
- **FR-002**: With wrap disabled (default), source-view line presentation MUST match today's behaviour exactly: long lines extend beyond the pane with horizontal scrolling.
- **FR-003**: With wrap enabled, lines exceeding the pane width MUST continue within the pane; ordinary prose lines MUST NOT require horizontal scrolling.
- **FR-004**: Changing the control MUST apply immediately to all open source views, without restarts or reopening tabs.
- **FR-005**: Toggling wrap MUST NOT alter document text, dirty state, per-document source-view context (selection/scroll persistence), or any saved bytes.
- **FR-006**: The preference MUST persist across restarts; a malformed stored value MUST fall back to the default through trusted-process validation without disturbing other settings.
- **FR-007**: Only the source view's line presentation changes; the visual editor always flows text within the pane and MUST NOT gain horizontal scrolling from this feature.

### Key Entities *(include if feature involves data)*

- **Word wrap preference**: A persisted boolean-style setting, defaulting to off, applied as a line-presentation property of every source view surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of toggle tests, an open source view reflects the change within one second.
- **SC-002**: In 100% of restart tests, the preference persists; fresh installs and upgrades start with today's behaviour (disabled).
- **SC-003**: In 100% of mid-edit toggle tests, text, selection coverage, and dirty state are preserved exactly.
- **SC-004**: In 100% of adversarial-config tests, malformed values fall back to the default with no error dialogs and no side effects on other settings.
- **SC-005**: Typing into a 10,000-line document's source view with wrap enabled remains imperceptibly latent per the project's responsiveness principle.

## Clarifications

### 2026-08-24 (during specification)

- **"and view source" reading**: interpreted as scope (the setting governs the source view). A separate quick-toggle control inside the source view surface is not part of this feature and may be specified later if wanted.

## Assumptions

- **Default off**: the source view currently never wraps, so "off" preserves existing behaviour for new and upgraded installations.
- **Visual editor out of scope**: WYSIWYG prose always flows; no wrap concept applies there.
- **Control shape**: two-state switch consistent with neighbouring Markdown-area controls; label wording finalised at implementation ("Word wrap").
