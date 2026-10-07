# Feature Specification: File Explorer Toggle Icon

**Feature Branch**: `spec-068-explorer-toggle-icon`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "is there a name for it? I want you write a speckit spec to change the icon in markdownmeister that toggles the file explorer to this icon (or very similar)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize and Toggle the File Explorer (Priority: P1)

A user sees a left-sidebar symbol on the file-explorer toggle in the header and can use it to hide or restore the file explorer. The symbol resembles the supplied reference: a thin outlined window with a narrow left pane and a wider right pane.

**Why this priority**: The requested icon depicts the layout controlled by the button more directly than the current four-square symbol.

**Independent Test**: Open a workspace, inspect the header icon against the reference description, then activate the button twice to hide and restore the explorer.

**Acceptance Scenarios**:

1. **Given** the application header is visible, **When** the user looks at the file-explorer toggle, **Then** its icon shows an outlined rectangular window divided vertically into a narrow left pane and a wider right pane, rather than four squares.
2. **Given** a workspace is open and the explorer is visible, **When** the user clicks the toggle, **Then** the explorer is hidden and the toggle remains available with the left-sidebar symbol.
3. **Given** a workspace is open and the explorer is hidden, **When** the user clicks the toggle, **Then** the explorer is restored and the toggle continues to show the left-sidebar symbol.
4. **Given** no workspace is open, **When** the header is displayed, **Then** the toggle shows the replacement symbol and remains disabled as before.

### User Story 2 - Use the Control Across Themes and Input Methods (Priority: P2)

A user can identify and operate the same control in light and dark themes, using a mouse, keyboard, or assistive technology.

**Why this priority**: Replacing the symbol must preserve the existing control's legibility and accessibility.

**Independent Test**: Inspect the icon in both application themes, check its tooltip and accessible name, and hide and restore the explorer using keyboard activation.

**Acceptance Scenarios**:

1. **Given** either the light or dark application theme is active, **When** the toggle is displayed, **Then** its outline and left-pane divider are distinguishable against the button background and its size and alignment match neighboring header icons.
2. **Given** the toggle is enabled, **When** the user hovers over it or inspects its accessible name, **Then** its tooltip and accessible name remain "Toggle file explorer".
3. **Given** a workspace is open and the toggle has keyboard focus, **When** the user activates it using the keyboard, **Then** the explorer visibility toggles as before and the existing focus treatment remains visible.

### Edge Cases

- With no workspace open, the replacement icon retains the existing disabled appearance and the control cannot toggle an explorer.
- With the explorer collapsed, the same left-sidebar symbol remains visible so the user can restore the pane.
- With an unsaved document open, hiding and restoring the explorer preserves its text and dirty state.
- In light and dark themes, including hover and keyboard-focus states, the narrow left pane remains identifiable at the normal header icon size.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST replace the current four-square icon on the header's file-explorer toggle with an outlined left-sidebar symbol matching the supplied reference or a visually similar equivalent.
- **FR-002**: The symbol MUST consist of a rectangular window outline with one vertical divider to the left of center, creating a narrow left pane and a wider right pane. It MUST use thin strokes and unfilled panes. Slightly rounded corners are acceptable.
- **FR-003**: The replacement icon MUST retain the existing header icon size, placement, alignment, and theme-dependent color treatment. The button's dimensions and interaction styling MUST remain unchanged.
- **FR-004**: The same symbol MUST be displayed when the explorer is visible, hidden, or unavailable. Existing disabled, hover, and focus treatments MUST be preserved.
- **FR-005**: The button MUST retain the tooltip and accessible name "Toggle file explorer" and its existing mouse and keyboard activation behavior.
- **FR-006**: The change MUST preserve existing explorer visibility behavior, workspace-dependent availability, layout persistence, and keyboard shortcuts. It MUST NOT modify document contents or dirty state.
- **FR-007**: The window outline and divider MUST remain distinguishable at the normal header icon size in both light and dark application themes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Visual inspection in both light and dark themes confirms all reference features: an outlined window, a single left-of-center vertical divider, unfilled panes, and a left pane narrower than the right pane.
- **SC-002**: In both themes, the toggle occupies the same button bounds and icon bounds as before and remains aligned with neighboring header controls.
- **SC-003**: Every acceptance scenario passes, including hide and restore actions, keyboard activation, the unchanged tooltip and accessible name, and disabled behavior without a workspace.
- **SC-004**: Hiding and restoring the explorer with an unsaved document produces zero changes to the document's text or dirty state.

## Assumptions

- The supplied image specifies the icon's visual metaphor. Its dark rounded-square background is the surrounding button, not a request to redesign the application's button or force a dark color in light mode.
- "Panel left" and "sidebar left" are descriptive names for this symbol. The specification does not require a particular icon library or exact pixel reproduction.
- A single static symbol is sufficient in both explorer visibility states, consistent with the request to replace the existing icon.
- This feature depends on the existing header file-explorer toggle and changes only its symbol. Other header and explorer controls are outside its scope.
