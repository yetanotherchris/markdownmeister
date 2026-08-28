# Feature Specification: Settings Dialog Fixes

**Feature Branch**: `spec-050-settings-dialog-fixes`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "the about page in the settings needs to remove the labels except e.g. repository url, and also remove the revision. Settings -> Editor theme - the drop down is right aligned but should be left aligned. no 'Theme' label is needed. The word wrap feature should be removed from settings and put as a button in the 'view source' view on the far right side of the header bar."

Three fixes to the settings dialog and its surrounding surfaces, bundled as one specification: simplifying the About area, correcting the editor theme dropdown's alignment and redundant label, and relocating the word wrap control from Settings into the source view's own header bar where it belongs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The About area shows only what matters (Priority: P1)

A user opening Settings, then About, sees a quieter panel than today. The version value stands on its own with no "Version" label in front of it. The "Repository URL" row stays exactly as it is today: its label, and the link that opens the project repository in the system browser. The Revision row, including its Copy affordance, is gone entirely; no revision identifier appears anywhere in the panel.

**Why this priority**: This is the most visible decluttering of the three changes and the panel's remaining content must stay fully functional while the row disappears.

**Independent Test**: Open Settings, select About, and confirm the version value is displayed without a label, the repository link is present and still opens the repository externally, and no revision identifier or copy control exists anywhere in the panel.

**Acceptance Scenarios**:

1. **Given** the About area is open, **When** the panel is inspected, **Then** the installed version is displayed as a bare value with no preceding "Version" label text.
2. **Given** the About area is open, **When** the panel is inspected, **Then** the "Repository URL" row is unchanged from today: same label, same link text, same behaviour.
3. **Given** the About area is open, **When** the user activates the repository link, **Then** the repository opens in the system's default browser exactly as today, with no in-application side effects.
4. **Given** the About area is open, **When** the panel is inspected, **Then** no revision identifier, revision label, or copy control appears anywhere in the panel, regardless of whether the running build carries revision metadata.
5. **Given** the About area is open, **When** the user reviews the panel, **Then** everything shown is read-only as today and closing the dialog never prompts about unsaved changes.

---

### User Story 2 - The editor theme dropdown sits at the left without a redundant label (Priority: P1)

A user opening Settings, then Theme, sees the editor theme offered as a single dropdown aligned to the left edge of the section's content, where labels and controls normally begin, instead of pushed to the right side of a label row. The visible "Theme" text beside the dropdown is gone; the "Editor Theme" section heading above it already names the control. Nothing about which themes are offered, how a choice is staged and saved, or how missing themes behave changes in any way.

**Why this priority**: A small alignment and label correction, but it removes a redundant label the section heading already provides and fixes a visually inconsistent control.

**Independent Test**: Open Settings, select Theme, and confirm the dropdown's left edge aligns with the left edge of the section content with no visible "Theme" label beside it; then select a theme and save and confirm the choice applies and persists exactly as before.

**Acceptance Scenarios**:

1. **Given** the Theme area is open, **When** the editor theme dropdown's position is compared with the section's left content edge, **Then** the dropdown starts at that left edge rather than sitting on the right side of a label row.
2. **Given** the Theme area is open, **When** the area around the dropdown is inspected, **Then** no visible "Theme" label text accompanies the dropdown.
3. **Given** the dropdown is operated from the keyboard or a screen reader, **When** the user reaches it, **Then** the control is still announced with a name identifying it as the editor theme selection, and keyboard selection behaves as today.
4. **Given** a theme chosen and saved, **When** the dialog is closed without saving, or saved and the application restarted, **Then** staged-save semantics and persistence behave exactly as today.
5. **Given** the stored selection's theme file is missing or invalid, **When** the Theme area opens, **Then** the existing no-selection placeholder and fallback behaviour appear exactly as today, with the invalid-file note beneath the control unchanged.

---

### User Story 3 - Word wrap is controlled from the source view header bar (Priority: P1)

A user working in the source view ("view source") finds a word wrap toggle as the rightmost control in the source view's header bar, opposite the back-to-visual-editing button at the far left. Activating it switches long-line wrapping on or off for the open source view immediately, shows which state is active, and the choice survives restarts. The word wrap control no longer exists anywhere in the Settings dialog; the Markdown area simply has one fewer switch, with its remaining controls untouched.

**Why this priority**: The control belongs next to the surface it affects, where the user can see and flip it while looking at long lines, instead of behind a settings dialog.

**Independent Test**: Open a document with a line wider than the pane, enter the source view, confirm the toggle at the far right of the header bar, toggle it, and confirm lines wrap and unwrap immediately; confirm the control is absent from Settings, Markdown; restart and confirm the last chosen state persists.

**Acceptance Scenarios**:

1. **Given** the source view is open, **When** the header bar is inspected, **Then** a word wrap toggle sits at the far right of the bar, with the back-to-visual-editing control remaining at the far left.
2. **Given** the toggle in either state, **When** it is activated, **Then** the open source view immediately wraps or unwraps long lines without reopening the tab or the application.
3. **Given** wrap disabled, **When** the source view shows a line wider than the pane, **Then** the line extends beyond the pane edge with horizontal scrolling, matching today's behaviour; with wrap enabled the same line continues within the pane.
4. **Given** the toggle, **When** its appearance is inspected, **Then** it visibly communicates whether wrap is currently on or off.
5. **Given** the Settings dialog's Markdown area, **When** inspected, **Then** no word wrap control exists, and every other Markdown-area control is present and unchanged.
6. **Given** a wrap state chosen, **When** the application restarts, **Then** the same state is in effect; a fresh installation starts with wrap off.
7. **Given** the toggle, **When** operated from the keyboard or a screen reader, **Then** it is reachable, activatable, and announced with its name and current on/off state.

---

### Edge Cases

**About area**:

- A development or unpackaged run without revision metadata: nothing revision-related was shown anyway after this change; the version still displays and the repository link still works.
- Very long repository URL at narrow dialog widths: the link wraps within the panel as today; no clipping or truncation is introduced.
- Removing the revision also removes the only dedicated copy affordance in the panel: no replacement copy control is added; nothing else in the panel changes to compensate.

**Editor theme dropdown**:

- Zero valid themes, many themes, unreadable theme files, missing selected theme: all handled exactly as today; this change moves and unlabels the control, not its behaviour.
- Screen-reader and keyboard users after the visible label is removed: the control must still carry a programmatic name so no user loses the ability to identify it.

**Word wrap toggle**:

- Toggling while the source view holds unsaved edits, a selection, or a mid-document caret: text, selection coverage, dirty state, and subsequent typing position are unaffected; only line presentation changes.
- Toggling while scrolled far to the right with wrap turning on: the view adjusts sanely; horizontal offset becomes meaningless and resets rather than erroring.
- Very long unbroken tokens (URLs, minified content) with wrap enabled: they break within the pane rather than forcing horizontal scrolling.
- Multiple tabs: the preference applies uniformly to every source view, current and future.
- Very large documents (10,000 lines) with wrap enabled: typing latency stays imperceptible per the project's responsiveness principles.
- A malformed stored preference value: rejected by trusted-process validation and quietly replaced by the default (off), with no error dialog and no effect on other settings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The About area MUST display the installed version as a bare value with no visible "Version" label preceding it.
- **FR-002**: The About area MUST retain the "Repository URL" row exactly as it exists today: its label, its link text, and its external hand-off to the system browser.
- **FR-003**: The About area MUST NOT display a revision identifier, a revision label, or a copy affordance, whether or not the running build carries revision metadata.
- **FR-004**: The About area MUST remain entirely read-only, and its changes MUST NOT affect the staged-save behaviour, validation, or layout of any other settings area.
- **FR-005**: The editor theme dropdown in the Theme area MUST be positioned at the left edge of the section's content, replacing its current position at the right side of a label row.
- **FR-006**: The editor theme dropdown MUST NOT have a visible "Theme" label beside it, and MUST retain an accessible, programmatic name so keyboard and screen-reader users can identify the control.
- **FR-007**: Editor theme selection behaviour MUST be unchanged: staged-save semantics, the discovered theme list and its ordering, the no-selection placeholder for a missing or invalid committed selection, and the invalid-file note beneath the control all behave exactly as today.
- **FR-008**: The Markdown area of the Settings dialog MUST NOT contain a word wrap control; all other Markdown-area controls remain present and unchanged.
- **FR-009**: The source view MUST include a word wrap toggle positioned as the rightmost control in its header bar, with the back-to-visual-editing control remaining at the far left.
- **FR-010**: The word wrap toggle MUST visibly communicate its current state (on or off) and MUST be operable by both pointer and keyboard, with its name and state available to assistive technology.
- **FR-011**: Activating the word wrap toggle MUST apply the change immediately to the open source view and to every subsequently opened source view, without reopening tabs or the application.
- **FR-012**: The word wrap preference MUST persist across restarts, defaulting to off; a malformed stored value MUST fall back to the default through trusted-process validation without disturbing other settings.
- **FR-013**: Toggling word wrap MUST NOT alter document text, dirty state, saved bytes, or the user's ability to continue typing at their current position; only line presentation changes.
- **FR-014**: Word wrap MUST continue to govern only the source view; the visual editor always flows text within the pane and MUST NOT gain horizontal scrolling from this feature.
- **FR-015**: All behaviour not named above MUST be unchanged: the spellcheck, file-opening, Markdown, and appearance settings; the About repository link; and every existing settings interaction.

### Key Entities *(include if feature involves data)*

- **Word wrap preference**: The persisted two-state setting (default off) introduced by an earlier feature. Its meaning, default, persistence, and effect are unchanged; only the surface that controls it moves, from the Markdown settings area into the source view's header bar.
- **About area**: The read-only settings panel, now presenting only the version value and the repository link; the revision identifier leaves its display.
- **Editor theme selection**: Unchanged data and behaviour; the control's position and labelling change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of visual checks across light and dark appearance, the About area shows the version value with no "Version" label, the unchanged repository row, and zero revision-related content.
- **SC-002**: In 100% of activation tests, the repository link opens the repository in the default browser with no in-application side effects, matching today's behaviour.
- **SC-003**: In 100% of visual checks, the editor theme dropdown's left edge coincides with the left edge of its section's content and no visible "Theme" label sits beside it.
- **SC-004**: In 100% of keyboard and screen-reader checks, the editor theme dropdown is identifiable by name and fully operable despite having no visible label.
- **SC-005**: In 100% of toggle tests, activating the source view's word wrap toggle changes the open source view's line presentation within one second, and the toggle's visible state always matches the applied state.
- **SC-006**: In 100% of restart tests, the wrap choice persists; fresh installs and upgrades that never touched the preference start with wrap off.
- **SC-007**: In 100% of mid-edit toggle tests, text, selection coverage, and dirty state are preserved exactly, and typing continues at the intended position.
- **SC-008**: The Settings dialog contains no word wrap control in 100% of checks, and every automated suite that exercised word wrap through the settings control is migrated to the source view's toggle and passes against the real built app.

## Assumptions

- **Label reading**: "Remove the labels except e.g. repository url" is interpreted as: the "Repository URL" row keeps its label; the "Version" row loses its label; and the Revision row is removed in its entirety (value and copy button with it, since "also remove the revision" names the revision itself, not merely its label). The alternative reading, removing every row label including "Repository URL", is noted here for the clarify step to confirm.
- **Superseded requirement**: Removing the revision display intentionally supersedes the revision-related requirements of the archived About Section specification (037). Support and bug reports lose the in-app revision copy path; no replacement is added because the user explicitly asked for the removal.
- **Toggle naming**: The source view button is referred to as "Word Wrap"; exact visible wording and any icon are finalised at implementation, following the existing source view header bar's button style.
- **Persistence retained**: The word wrap choice remains a persisted preference exactly as today; the change is only where it is controlled, not how it is stored or applied.
- **Toggle state visual**: The toggle distinguishes on from off through its own visual pressed/unpressed presentation; no extra explanatory text is added to the header bar.
- **Dropdown alignment reference**: "Left aligned" means starting at the section's normal left content edge (where other controls and text begin), not that the dropdown stretches to fill the row width.
- **Scope boundaries**: No new settings, no changes to theme discovery or validation, no changes to the visual editor's line flow, and no compensation elsewhere for the removed revision row.
