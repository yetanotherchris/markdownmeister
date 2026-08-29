# Feature Specification: Word Wrap Checkbox and About Page Tweaks

**Feature Branch**: `054-wordwrap-checkbox-about`

**Created**: 2026-08-29

**Status**: Archived

**Input**: User description: "change the wordwrap so it's a checkbox, or toggle button in view source mode. Change the "about" page in settings so it displays v.1.2.3  and remove the "repository url" label."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Word Wrap as a Checkbox in Source View (Priority: P1)

A user who switches a document to source view mode wants to control whether long lines wrap at the edge of the editor. Today the word wrap control is a press-style button whose on/off state is easy to miss. It becomes a labelled checkbox in the source view toolbar, so the current state and the way to change it are unmistakable at a glance.

**Why this priority**: Word wrap affects every source view editing session. Presenting the control as a state-bearing checkbox removes ambiguity about whether wrapping is currently on, which is the main pain with the current control.

**Independent Test**: Switch any document to source view and toggle the word wrap checkbox. Wrapping behaviour changes immediately and the checkbox state always matches the wrapping behaviour.

**Acceptance Scenarios**:

1. **Given** a document open in source view mode, **When** the user looks at the source view toolbar, **Then** a checkbox labelled for word wrap is present and its checked state matches the current wrapping behaviour.
2. **Given** word wrap is currently off, **When** the user checks the checkbox, **Then** long lines wrap within the editor immediately and the checkbox shows checked.
3. **Given** word wrap is currently on, **When** the user unchecks the checkbox, **Then** lines no longer wrap (long lines extend beyond the editor edge) immediately and the checkbox shows unchecked.
4. **Given** the user has chosen a word wrap state and restarted the application, **When** they open a document in source view, **Then** the checkbox state matches the previously chosen preference.
5. **Given** word wrap is on in source view, **When** the user returns to visual editing and later re-enters source view in the same session, **Then** the checkbox is still checked and visual editing layout was never affected by the word wrap setting.

---

### User Story 2 - About Section Version Format and Label Removal (Priority: P2)

A user opening the settings About section sees the application version displayed with a "v." prefix (for example, version 1.2.3 displays as "v.1.2.3"), and the "Repository URL" text label no longer appears.

**Why this priority**: A presentation-only change to a rarely visited screen, but explicitly requested and directly visible.

**Independent Test**: Open settings, view the About section, and confirm the version text starts with "v." followed by the version number, and that no "Repository URL" label appears.

**Acceptance Scenarios**:

1. **Given** the settings window is open, **When** the user views the About section, **Then** the version is displayed as "v." immediately followed by the application version number (for example "v.1.2.3").
2. **Given** the settings window is open, **When** the user views the About section, **Then** the text "Repository URL" does not appear anywhere in the section.
3. **Given** the About section without the label, **When** the user wants to reach the project repository, **Then** the clickable repository link is still available and still opens the repository.

---

### Edge Cases

- What happens when the version cannot be determined (for example a broken build)? The version row is hidden rather than showing a bare "v." with no number.
- What happens when the source view toolbar is cramped by a very narrow window? The checkbox must remain visible and operable; the layout may compress but must not hide the control entirely or make its state unreadable.
- What happens when word wrap is toggled on a very large document (10,000+ lines)? The change applies without a perceptible freeze; the editor must stay responsive on the keystroke path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Source view mode MUST present the word wrap control as a checkbox (or an equivalent toggle whose on/off state is unmistakable without a tooltip) in the source view toolbar.
- **FR-002**: The word wrap checkbox MUST visibly reflect the current wrapping state at all times: checked when wrapping is on, unchecked when off.
- **FR-003**: Changing the checkbox MUST apply the new word wrap state to the open document immediately, without reloading or reopening the document.
- **FR-004**: The word wrap preference MUST persist across application restarts, and the checkbox state on next launch MUST match the stored preference.
- **FR-005**: The word wrap setting MUST apply only to source view mode; visual editing mode MUST NOT change its layout when the setting is toggled.
- **FR-006**: The About section in settings MUST display the application version prefixed with "v.", so version 1.2.3 displays as "v.1.2.3".
- **FR-007**: The About section MUST NOT display the text label "Repository URL".
- **FR-008**: The clickable repository link MUST remain in the About section after the label is removed, and MUST still open the repository when activated.
- **FR-009**: The displayed version MUST come from the application's actual version information; it MUST NOT be a fixed value written into the interface.

### Key Entities *(include if feature involves data)*

- **Word wrap preference**: A persisted user setting, on or off, defaulting to off, applying to source view mode only.
- **Build information**: The application version number and repository URL surfaced to the About section of settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user in source view can determine the current word wrap state at a glance and change it with a single click on the checkbox.
- **SC-002**: Toggling word wrap takes effect on the visible document immediately, with no perceptible delay for documents up to 10,000 lines.
- **SC-003**: Every view of the About section shows the version prefixed with "v." and no view shows the text "Repository URL".
- **SC-004**: The word wrap preference survives an application restart, with the checkbox reflecting the stored value on relaunch.

## Assumptions

- "v.1.2.3" in the request describes the display format; the number shown is the application's actual version, not a fixed "1.2.3" value.
- Removing the "Repository URL" label means removing the label text only. The clickable repository link itself stays in the About section. If the whole row was meant to go, that is a one-line reversal.
- The new checkbox replaces the current word wrap button in the existing source view toolbar; no new screen or panel is introduced.
- Word wrap is already a persisted preference and already applies only to source view; both behaviours continue unchanged, they are restated here as requirements so the change does not regress them.
- If the version is unavailable, the version row is hidden rather than showing a bare "v.".
