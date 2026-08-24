# Feature Specification: Editor Theme Dropdown Selection

**Feature Branch**: `spec-047-editor-theme-dropdown`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "In the settings, theme page, 'Editor themes' there should be a drop down of the themes instead of radio boxes. This should be populated from the json files in the themes directory in the config directory."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choosing an editor theme is one dropdown selection (Priority: P1)

A user opening Settings, then Theme, finds the editor theme offered as a single dropdown listing every discovered theme. The list comes from the theme files in the configuration directory's themes folder, one entry per valid file, named after the file. Picking an entry stages it; Save applies it and the choice survives restart; leaving without Save discards it. Nothing about how themes are discovered, validated, applied, or persisted changes.

**Why this priority**: The control swap with unchanged semantics is the whole request.

**Independent Test**: With several theme files present, open the Theme area, confirm the dropdown lists exactly those themes, select a different one, cancel without saving (unchanged appearance), reopen, select and Save, and confirm the new theme applied and persists across restart.

**Acceptance Scenarios**:

1. **Given** the configuration themes folder contains a set of valid theme files, **When** the user opens the Theme area, **Then** the dropdown lists exactly those themes, named by file name without extension, in alphabetical order.
2. **Given** a theme chosen in the dropdown but not yet saved, **When** the user closes the dialog without saving, **Then** the previously applied theme remains in effect and nothing was persisted.
3. **Given** a theme chosen and Save pressed, **When** the application restarts, **Then** that theme is still selected and applied.
4. **Given** a newly added or removed theme file, **When** the dialog is reopened, **Then** the dropdown reflects the current set of files.

---

### User Story 2 - Broken selections stay safe and visible (Priority: P1)

The stored selection can reference a theme whose file has been deleted, renamed, or become invalid. In that case the dropdown shows no selection rather than silently naming a theme that does not exist, while the application keeps rendering its fallback default as specified elsewhere. Unreadable files continue to be reported by the existing quiet note beneath the control.

**Why this priority**: The dropdown replaces a control where "no match" had no representation; the placeholder state must not regress the fail-safe behaviour introduced with file-based themes.

**Independent Test**: Select a theme, delete its file, reopen settings, and confirm the dropdown shows no selection, the editor renders the fallback default, the quiet note lists unreadable files where applicable, and no error appears.

**Acceptance Scenarios**:

1. **Given** the stored selection's file is missing or invalid, **When** the Theme area opens, **Then** the dropdown displays a placeholder (no theme selected) instead of an arbitrary entry.
2. **Given** the situation above, **When** the user saves without choosing a theme, **Then** the existing fallback-and-repair behaviour resolves the selection to a default exactly as today, with no error dialog.
3. **Given** one or more unreadable theme files exist alongside valid ones, **When** the Theme area opens, **Then** the quiet indication listing rejected file names still appears beneath the dropdown, and only valid themes are listed.

---

### Edge Cases

- Many themes installed: the dropdown scrolls natively; no pagination or search is required.
- Zero valid themes: the dropdown offers no entries, the editor continues on its built-in fallback appearance quietly.
- Names are file stems used verbatim (including hyphens and digits): displayed exactly as named, matching today's labelling.
- Case-collision losers and symlinked files: excluded from the list exactly as discovery already excludes them.
- Keyboard operation: the control is reachable, openable, and adjustable from the keyboard, with the label announced; staged-save keyboard flows (Save/Cancel) behave as today.
- Dialog reopened mid-session: the list refreshes per the existing refresh-on-open rule; a draft choice behaves like today's staged draft.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Editor Theme section MUST present theme selection as a single-value dropdown, replacing the radio-button list.
- **FR-002**: Dropdown entries MUST be exactly the discovered valid themes sourced from the configuration directory's themes folder, identified by file stem, in alphabetical order.
- **FR-003**: Staged-save semantics MUST be preserved: changing the dropdown MUST NOT alter the applied editor appearance until Save is activated; leaving the dialog without Save discards the staged choice.
- **FR-004**: When the committed selection matches no discovered theme, the dropdown MUST present an explicit no-selection state, and the existing silent fallback and repair of the stored selection MUST continue unchanged.
- **FR-005**: The quiet, non-modal indication of unreadable theme files MUST be retained beneath the control.
- **FR-006**: The control MUST have an associated accessible label and full keyboard operability.
- **FR-007**: Theme discovery, validation, application, persistence, refresh-on-dialog-open, and upgrade-migration behaviours MUST be unchanged by this feature.

### Key Entities *(include if feature involves data)*

- **Discovered theme / Themes folder / Stored selection**: unchanged from spec 036's definitions; this feature changes only the presentation of selection.
- **Draft selection**: the staged, unsaved choice held while the dialog is open; gains a no-selection placeholder representation when the committed value matches no discovered theme.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tests with N valid theme files, the dropdown offers exactly N entries with matching names in alphabetical order.
- **SC-002**: Close-without-Save discards the staged choice and leaves the applied theme untouched in 100% of tests; Save commits it and it survives restart in 100% of tests.
- **SC-003**: Missing/invalid selected-file cases show the no-selection state with zero error dialogs and correct fallback rendering in 100% of tests.
- **SC-004**: All suites that exercised theme selection through radios are migrated to the dropdown and pass against the real built app.

## Clarifications

### 2026-08-24 (user direction)

- **Population source confirmed**: the dropdown is populated strictly from theme files in the configuration themes folder (as established by spec 036); there is no separate built-in list shown alongside them.

## Assumptions

- **Control style**: a native dropdown consistent with the existing spellcheck language selector's look and behaviour; no custom listbox, search, or preview pane.
- **Section naming**: the fieldset heading stays "Editor Theme"; the radio group's accessibility name is preserved so navigation helpers keep working.
- **Placeholder wording**: the no-selection state reads approximately "No matching theme" (final copy at implementation).
