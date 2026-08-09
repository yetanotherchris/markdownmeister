# Feature Specification: Open With Toggle

**Feature Branch**: `028-open-with-toggle`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Add a settings toggle that registers the 'Open with MarkdownMeister' context-menu entry at runtime so Scoop/portable installs get the feature too. Also fix two editor issues carried over from the settings-redesign work: small pages leave white behind in the editor instead of the theme canvas colour, and the view-source icon should be the heroicons code-bracket-square in dark blue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle the "Open with" context menu from Settings (Priority: P1)

A Windows writer who installed the application without the installer (for example
through a package manager or a portable archive) can turn on the operating
system's "Open with" context-menu entry from the Settings dialog, and turn it
off again, without reinstalling or editing the operating system's configuration
by hand.

**Why this priority**: The context-menu integration currently ships only with the
installer, so portable and package-manager installs have no way to open files
from the file browser at all. A Settings toggle is the only registration path
those installs have, and it makes the behaviour discoverable and reversible.

**Independent Test**: Install the application through a portable channel, open
Settings, toggle the context-menu switch on, right-click a `.md` file and a
folder in the file browser, and verify the product-named action appears and
opens the item. Toggle the switch off and verify the action disappears.

**Acceptance Scenarios**:

1. **Given** a Windows installation without the installer having registered
   anything, **When** the user turns on the "Open with" switch in Settings,
   **Then** the operating system context menu for a `.md` file and for a folder
   shows an action bearing the product name that opens the item in the
   application.
2. **Given** the switch is on, **When** the user turns it off, **Then** the
   context-menu action is removed from supported files and folders.
3. **Given** the user closes and reopens the application, **When** they open
   Settings, **Then** the switch shows the state they last chose.
4. **Given** the switch is on and the application has moved to a new location
   (for example an update), **When** the application starts, **Then** the
   context-menu action is repaired to point at the new location.
5. **Given** the switch is on and another application is the user's default for
   markdown files, **When** the context-menu action is added, **Then** the
   default application is unchanged.
6. **Given** a user with an installer-based installation where the action
   already exists, **When** they first open Settings, **Then** the switch is on,
   matching the existing state.
7. **Given** a non-Windows platform, **When** the user opens Settings, **Then**
   no "Open with" switch is shown (runtime registration is not possible there).

---

### User Story 2 - The editor canvas colour fills the whole editor (Priority: P2)

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

### User Story 3 - Recognisable, coloured view-source action (Priority: P2)

A writer can identify the view-source action at a glance by its familiar
code-bracket-square glyph in dark blue, in both the editor top bar and the
explorer context menu.

**Why this priority**: The action is currently easy to miss and uses a generic
chevron glyph; a recognisable icon in a deliberate colour makes the most-used
editing action discoverable.

**Independent Test**: Open a document, inspect the view-source action in the
editor top bar and the explorer context menu, and verify the glyph is the
code-bracket-square shape rendered in dark blue against both light and dark
backgrounds.

**Acceptance Scenarios**:

1. **Given** a document is open, **When** the user views the editor top bar,
   **Then** the view-source action shows a code-bracket-square glyph.
2. **Given** the view-source action is visible, **When** the user inspects its
   colour, **Then** it is dark blue.
3. **Given** the view-source action is shown in the explorer context menu,
   **When** the user inspects it, **Then** it uses the same glyph and dark-blue
   colour.
4. **Given** either light or dark mode, **When** the user looks at the action,
   **Then** it remains clearly visible against the background.

---

### Edge Cases

- Adding or removing the context-menu action fails (permission, policy, missing
  system tooling): the application reports a clear in-context error and the
  switch reflects the actual state — it must not silently claim the action was
  added or removed.
- The user toggles the switch repeatedly or quickly: the final state converges
  to the last choice and every operation completes without leaving a
  half-registered action.
- The application executable is on a read-only or otherwise unwritable path:
  registration still works because it records the path, not the files; a later
  move is handled by the repair-on-launch behaviour.
- A portable installation is deleted without turning the switch off first: a
  stale context-menu entry may remain (there is no uninstaller for a manually
  unzipped archive); the package-manager path removes it on uninstall.
- The user's default application for markdown files is a rich editor: adding or
  removing the action never changes that default.
- A document has zero content or a single character: the editor canvas colour
  still fills the full editor region.
- The view-source icon in dark mode sits on a dark canvas: the dark blue must
  stay distinguishable, not merge into the background.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On Windows, the Settings dialog MUST present a switch, labelled
  with the product name, that controls the operating system's "Open with"
  context-menu action for supported markdown files and folders.
- **FR-002**: Enabling the switch MUST add the context-menu action, pointing at
  the running application's executable, for supported markdown files and for
  folders.
- **FR-003**: Disabling the switch MUST remove those context-menu actions.
- **FR-004**: The switch state MUST be persisted and restored across restarts.
- **FR-005**: When the switch is on and the context-menu action is missing or
  points at a different executable on startup, the application MUST restore it
  to point at the current executable.
- **FR-006**: Registering or removing the action MUST NOT change the user's
  default application for markdown files or folders.
- **FR-007**: A failed register or remove operation MUST fail closed: it MUST
  report a clear in-context error, leave the switch showing the true state, and
  not claim a change that did not happen.
- **FR-008**: The switch MUST NOT be offered on platforms where runtime
  registration is not possible.
- **FR-009**: Uninstalling the application through a supported package manager
  MUST remove any context-menu actions the feature created.
- **FR-010**: The context-menu label and registration MUST derive from the same
  single product display name value as every other native action.
- **FR-011**: The editor canvas colour of the active theme MUST extend from the
  top of the editor area to its bottom, regardless of document length.
- **FR-012**: No region of the editor area MAY render a colour outside the
  active theme's canvas palette.
- **FR-013**: The full-height canvas behaviour MUST hold for every editor theme
  and in both light and dark modes.
- **FR-014**: The view-source action MUST display the code-bracket-square icon
  shape.
- **FR-015**: The view-source icon MUST be rendered in a dark blue colour.
- **FR-016**: The view-source icon MUST remain visible against both light and
  dark editor backgrounds.

### Key Entities

- **Open-with preference**: The persisted user choice controlling whether the
  "Open with" context-menu action is registered; distinct from the operating
  system state it drives, which can drift (manual edits, moves, uninstalls).
- **Context-menu registration**: The per-user operating-system state that makes
  the product-named action appear for supported markdown files and folders,
  always pointing at the running executable.
- **Editor canvas colour**: The theme's background palette value that fills the
  editing surface behind the document content.
- **View-source glyph**: The code-bracket-square icon used by the view-source
  action, rendered in a dark blue colour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of Windows toggle tests, enabling the switch adds and
  disabling it removes the product-named action for supported files and folders,
  and the user's default application remains unchanged.
- **SC-002**: In 100% of fresh portable-install tests, the switch defaults to
  off and can be turned on and off without any manual registry step.
- **SC-003**: In 100% of short-document tests across all five editor themes and
  both light and dark modes, the editor region shows the theme canvas colour
  edge to edge with no contrasting patch.
- **SC-004**: In 100% of visual checks across light and dark mode, the
  view-source action shows the code-bracket-square glyph in dark blue and is
  legible against the background.

## Assumptions

- **Platform scope**: The "Open with" toggle applies to Windows only. macOS
  already appears in Finder's "Open With…" via its declared document types, and
  runtime registration is not offered there (FR-008). Linux remains out of
  scope, consistent with spec 006.
- **Registration mechanics**: The toggle manages the same per-user
  context-menu entries the installer already creates for `.md`, `.markdown`,
  and folders, so installer-based and portable installs converge on one
  mechanism.
- **Default state**: Fresh portable installs default the switch to off (opt-in,
  honouring the "no silent system change" principle). When an existing
  installer-registered action is detected on first launch, the switch defaults
  to on so it matches reality (US1 scenario 6).
- **Folder entries**: The toggle registers files and folders together, matching
  the installer's scope.
- **Dark blue**: "Dark blue" is a single curated colour distinct from the
  accent token, chosen so it reads clearly on both light and dark canvases
  (FR-016); the exact value is a plan-level decision.
- **Carry-over fixes**: The editor-canvas and view-source icon issues were part
  of the settings-redesign feature's original input but were not fully
  delivered; this spec covers them explicitly so their completion is verifiable.
- **Package-manager cleanup**: For Scoop, the manifest is extended with an
  uninstall-time step that removes the registered actions (FR-009). Manually
  unzipped portable archives have no uninstaller; the documented limitation is
  that their entry may persist if the user deletes the folder without toggling
  the switch off first (Edge Cases).
