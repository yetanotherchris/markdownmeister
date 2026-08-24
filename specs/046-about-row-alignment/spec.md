# Feature Specification: About Section Alignment

**Feature Branch**: `spec-046-about-row-alignment`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "In settings -> about, there is padding for version, repository url etc. that need removing so it aligns with the 'About' header."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - About rows align with the section heading (Priority: P1)

A user opening Settings, then About, sees the Version, Repository URL, and Revision rows starting at the same left edge as the bold "About" heading above them. The extra indentation that currently pushes those rows to the right of the heading is gone.

**Why this priority**: This is a single visual correction; there is nothing else to the feature.

**Independent Test**: Open Settings, select About, and compare the left edge of the "About" heading with the left edge of the "Version" label beneath it: they coincide.

**Acceptance Scenarios**:

1. **Given** the About area is open, **When** the left edges of the heading and each row label (Version, Repository URL, Revision) are compared, **Then** they all sit on one vertical line with no horizontal offset.
2. **Given** the About area is open in light or dark appearance, **When** the rows are inspected, **Then** alignment holds and no other spacing property changes noticeably beyond the removed indentation.
3. **Given** any other settings area (General, Theme, Markdown), **When** compared before and after this change, **Then** its padding and layout are untouched.

---

### Edge Cases

- Long values that wrap (full revision identifier): wrapped lines keep the same left edge as their label; nothing overflows or clips.
- Extremely narrow dialog widths: rows flow as today minus the removed horizontal padding; no truncation is introduced.
- Keyboard navigation and screen-reader reading order: unchanged; this is a presentation-only adjustment.
- Copying the revision and activating the repository link: behaviours are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each labelled row in the About area MUST share the same left edge as the "About" section heading, with no additional horizontal indentation.
- **FR-002**: Only the About-area rows' horizontal padding is removed; vertical rhythm between rows and the padding conventions of every other settings area MUST remain as they are.
- **FR-003**: All existing About behaviour (repository link activation, revision selection/copy, development-build placeholder) MUST be unchanged.

### Key Entities *(include if feature involves data)*

- None beyond the existing About area presentation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of visual checks across light/dark appearance and Windows/macOS/Linux, row labels align exactly with the heading's left edge.
- **SC-002**: The existing About automated suite passes without behavioural changes to what it asserts about link, copy, and placeholder functionality.

## Assumptions

- **Vertical spacing preserved**: Removing only the horizontal component keeps comfortable separation between rows; if the rows look too tight afterwards, vertical spacing may be tuned within this spec's scope.
- **Label column retained**: The fixed-width label column stays, so value columns also align consistently across rows.
