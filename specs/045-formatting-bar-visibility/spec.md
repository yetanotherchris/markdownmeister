# Feature Specification: Formatting Bar Visibility Setting

**Feature Branch**: `spec-045-formatting-bar-visibility`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "There should be a new markdown setting to set the visibility of header (formatting) bar in the visual editor - visible or not not visible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The user can hide and show the formatting bar (Priority: P1)

A user who prefers a distraction-free writing surface opens Settings, switches to the Markdown area, and turns the formatting bar visibility off: the bar above the visual editor disappears immediately in every open document. Turning it back on brings it back just as immediately. The choice survives closing and reopening the application.

**Why this priority**: The toggle and its immediate, persistent effect are the entire feature.

**Independent Test**: Open settings, toggle the control off, confirm the bar is gone from an open visual editor without restarting, restart the app, and confirm it is still gone; toggle on and confirm it returns.

**Acceptance Scenarios**:

1. **Given** the settings dialog's Markdown area, **When** the user inspects it, **Then** a formatting bar visibility control with exactly two states (visible, hidden) exists alongside the other Markdown-area controls.
2. **Given** the visibility set to hidden, **When** any document is open in the visual editor, **Then** the formatting bar is absent from that surface immediately, without restarting the application or reopening tabs.
3. **Given** the visibility set to hidden, **When** the application is closed and reopened, **Then** the bar remains hidden and the control shows hidden.
4. **Given** the visibility toggled back to visible, **When** the user looks at an open visual editor, **Then** the bar is restored immediately with its current full behaviour.

---

### User Story 2 - Hiding is complete hiding (Priority: P1)

With the bar hidden, no trace of it remains in the editing layout: it reserves no space, cannot receive clicks or keyboard focus, and does not appear in screenshots of the writing surface. The document area simply gains the vertical room the bar previously occupied.

**Why this priority**: A half-hidden bar (blank strip, focus trap) would defeat the purpose of a clean writing surface and could break keyboard flow.

**Independent Test**: Hide the bar, inspect the layout height above the document content, tab through the interface, and click where the bar used to be; confirm nothing intercepts input and no empty strip remains.

**Acceptance Scenarios**:

1. **Given** the bar hidden, **When** the layout is measured, **Then** the space previously occupied by the bar has collapsed into the editing area.
2. **Given** the bar hidden, **When** the user presses Tab repeatedly from the document, **Then** focus never lands on an invisible bar control.
3. **Given** the bar hidden, **When** the user clicks at the top edge of the former bar area, **Then** the click reaches the underlying application surface, not a ghost of the bar.

---

### Edge Cases

- Focus resting inside the bar when the setting hides it: focus moves to a sensible place (the document) without getting lost or trapping keyboard navigation.
- Keyboard-only operation with the bar hidden: formatting actions reachable only through the bar are unavailable while hidden, which is the intended trade-off; the setting itself stays fully operable by keyboard.
- Several tabs open, mixed view modes: visibility applies uniformly to every visual-editor surface; documents in source view are unaffected either way.
- Narrow window sizes: with the bar visible, existing wrapping/overflow behaviour of the bar is unchanged; hidden behaves as above.
- Stored configuration contains a malformed value for this preference (hand-edited config): the trusted process rejects it and the default applies without disturbing neighbouring settings.
- Upgrade installations with existing configurations: the preference is absent, so today's appearance (visible) results without migration steps.
- Settings dialog interactions elsewhere (staged theme selection, staged saves): adding this control changes nothing about them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Markdown area of the settings dialog MUST offer a formatting bar visibility control with exactly two states: visible and not visible.
- **FR-002**: Changing the control MUST take effect immediately in all open visual editors, with no restart and no tab reopen.
- **FR-003**: The hidden state MUST remove the bar completely: no occupied layout space, no interaction target, no residual strip.
- **FR-004**: The chosen state MUST persist across application restarts.
- **FR-005**: The default state MUST be visible, preserving today's appearance for new and upgraded installations.
- **FR-006**: The stored value MUST be validated by the trusted process; a malformed stored value MUST fall back to the default quietly, leaving other settings untouched.
- **FR-007**: Only the visual editor's formatting bar is affected; the source view and all other application chrome are unchanged.

### Key Entities *(include if feature involves data)*

- **Formatting bar visibility**: A single persisted boolean-style preference, defaulting to visible, applied as a presentation property of every visual-editor surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of toggle tests, the bar appears or disappears within one second across all open visual editors, with zero restarts.
- **SC-002**: In 100% of restart tests, the chosen state persists exactly.
- **SC-003**: On fresh installs and upgrades in 100% of tests, the bar starts visible and the control reads visible.
- **SC-004**: In 100% of adversarial-config tests, malformed values for this preference yield the default with no error dialog and no effect on other settings.
- **SC-005**: With the bar hidden, the editing area's top offset equals what it would be without any bar element present (zero reserved height) in 100% of measured layouts.

## Assumptions

- **Naming**: The preference is presented as "formatting bar" (the row of formatting buttons at the top of the visual editor); exact label wording is decided at implementation.
- **Control shape**: A two-state switch matching the Markdown area's existing control conventions; not a tri-state or per-document override.
- **Scope**: Applies to the visual editor's bar only; there is no equivalent bar in the source view today, so nothing else can be hidden by this setting.
