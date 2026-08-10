# Feature Specification: Editor Visual Fixes

**Feature Branch**: `028-editor-visual-fixes`

**Created**: 2026-08-09

**Status**: Archived

**Input**: User description: "Fix two editor issues carried over from the
settings-redesign work: small pages leave white behind in the editor instead of
the theme canvas colour, and the view-source icon should be the heroicons
code-bracket-square in dark blue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The editor canvas colour fills the whole editor (Priority: P1)

A writer viewing a short document sees the editor theme's canvas colour from the
top of the editor area to the bottom, with no white or chrome-coloured patch
below the last line.

**Why this priority**: A stray patch of the wrong colour breaks the calm,
cohesive editing surface the themes are designed to provide, and it is most
visible exactly when the document is short.

**Independent Test**: Open a one-line document in each editor theme, in both
light and dark mode, and verify the entire editor region below the text shows
the theme's canvas colour edge to edge.

**Acceptance Scenarios**:

1. **Given** a document shorter than the editor viewport and the Rustic theme,
   **When** the document is displayed, **Then** the editor region shows the
   Rustic canvas colour from the top to the bottom, with no other colour patch
   behind or below the content.
2. **Given** a short document in a dark theme (dark mode), **When** the document
   is displayed, **Then** the same full-height canvas behaviour holds with the
   dark canvas colour.
3. **Given** a short document, **When** the user changes the editor theme,
   **Then** the full editor region updates to the new canvas colour with no
   residual patch.
4. **Given** a document longer than the viewport, **When** the user scrolls,
   **Then** the canvas colour extends behind the content as the document
   scrolls, with no other colour appearing at the edges.

---

### User Story 2 - Recognisable, coloured view-source action (Priority: P2)

A writer can identify the view-source action at a glance by its familiar
code-bracket-square glyph in dark blue, in the editor top bar.

**Why this priority**: The action is currently easy to miss and uses a generic
chevron glyph; a recognisable icon in a deliberate colour makes the most-used
editing action discoverable.

**Independent Test**: Open a document, inspect the view-source action in the
editor top bar, and verify the glyph is the code-bracket-square shape rendered in
dark blue against both light and dark backgrounds.

**Acceptance Scenarios**:

1. **Given** a document is open, **When** the user views the editor top bar,
   **Then** the view-source action shows a code-bracket-square glyph.
2. **Given** the view-source action is visible, **When** the user inspects its
   colour, **Then** it is dark blue.
3. **Given** the view-source action is shown in the explorer context menu,
   **When** the user inspects it, **Then** it is a plain text item with no glyph
   (clarified 2026-08-10: the dark-blue code-bracket-square icon is a top-bar
   affordance only; the context menu keeps its text label).
4. **Given** either light or dark mode, **When** the user looks at the action,
   **Then** it remains clearly visible against the background.

---

### Edge Cases

- A document has zero content or a single character: the editor canvas colour
  still fills the full editor region.
- The view-source icon in dark mode sits on a dark canvas: the dark blue must
  stay distinguishable, not merge into the background.
- A very long document scrolled to the bottom: the canvas colour still fills the
  editor region with no other colour patch appearing at the edges.
- A custom editor theme (user-defined colours) renders a short document: the
  custom canvas colour fills the full editor region like every preset theme.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor canvas colour of the active theme MUST extend from the
  top of the editor area to its bottom, regardless of document length.
- **FR-002**: No region of the editor area MAY render a colour outside the
  active theme's canvas palette.
- **FR-003**: The full-height canvas behaviour MUST hold for every editor theme,
  including custom themes, and in both light and dark modes.
- **FR-004**: The view-source action in the editor top bar MUST display the
  code-bracket-square icon shape.
- **FR-005**: The view-source icon MUST be rendered in a dark blue colour.
- **FR-006**: The view-source icon MUST remain visible against both light and
  dark editor backgrounds.

### Key Entities

- **Editor canvas colour**: The theme's background palette value that fills the
  editing surface behind the document content.
- **View-source glyph**: The code-bracket-square icon used by the view-source
  action, rendered in a dark blue colour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of short-document tests across all five editor themes,
  custom themes, and both light and dark modes, the editor region shows the
  theme canvas colour edge to edge with no contrasting patch.
- **SC-002**: In 100% of visual checks across light and dark mode, the
  view-source action shows the code-bracket-square glyph in dark blue and is
  legible against the background.

## Assumptions

- **Dark blue**: "Dark blue" is a single curated colour distinct from the accent
  token, chosen so it reads clearly on both light and dark canvases (FR-006);
  the exact value is a plan-level decision.
- **Scope**: The view-source icon appears in the editor top bar only. The
  explorer context menu keeps its plain "View source" text item with no glyph
  (clarified 2026-08-10).
- **Carry-over fixes**: These two issues were part of the settings-redesign
  feature's original input but were not fully delivered; this spec covers them
  explicitly so their completion is verifiable. (The "Open with" context-menu
  registration that originally accompanied them was dropped from this spec and
  is handled separately as a defect fix to the Windows installer.)
