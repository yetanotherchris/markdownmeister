# Feature Specification: Open With Registration

**Feature Branch**: `028-open-with-registration`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Register the 'Open with MarkdownMeister' context-menu action from the install channels, not from an in-app setting: Scoop registers and deregisters, and the NSIS installer can as well. Also fix two editor issues carried over from the settings-redesign work: small pages leave white behind in the editor instead of the theme canvas colour, and the view-source icon should be the heroicons code-bracket-square in dark blue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The install channel brings the "Open with" action (Priority: P1)

A Windows writer who installs the application through either the installer or
the Scoop package manager gets the "Open with MarkdownMeister" action in the
file browser automatically, and it disappears when they uninstall — no settings
screen, no manual steps.

**Why this priority**: The context-menu action is a property of how the
application is installed, exactly as the installer already behaves. Owning the
registration in the install channels means Scoop users get the feature for the
first time, and every channel removes what it added on uninstall, so nothing is
left behind.

**Independent Test**: Install the application with its Windows installer, open a
`.md` file and a folder from the file browser using the product-named action,
then uninstall and confirm the action is gone. Repeat the whole cycle through
Scoop.

**Acceptance Scenarios**:

1. **Given** the application is installed via its Windows installer, **When** the
   user right-clicks a supported markdown file or a folder, **Then** an action
   bearing the product name appears and opens the item in the application.
2. **Given** that install, **When** the user uninstalls through the installer,
   **Then** the action is removed.
3. **Given** the application is installed via Scoop, **When** the user
   right-clicks a supported markdown file or a folder, **Then** the action
   appears and opens the item in the application.
4. **Given** that install, **When** the user uninstalls through Scoop, **Then**
   the action is removed.
5. **Given** another application is the user's default for markdown files,
   **When** the action is added or removed, **Then** the default application is
   unchanged.
6. **Given** a manually unzipped portable archive, **When** the user
   right-clicks a supported file or folder, **Then** no action appears (a
   portable install registers nothing).

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

- A Scoop update replaces the application directory with a new version: the
  registered action keeps pointing at a valid executable after the update
  (either the manifest re-registers or the registered path stays valid across
  versions), and a later uninstall still removes it.
- An install or uninstall step fails midway (permission, policy, missing system
  tooling): it fails closed and does not corrupt unrelated file associations.
- The installer is uninstalled: everything it registered is removed, with no
  broken menu entry left behind (spec 006 behaviour).
- A manually unzipped portable archive is deleted: nothing was registered, so
  nothing lingers.
- The user's default application for markdown files is a rich editor: adding or
  removing the action never changes that default.
- The user has chosen a default application for markdown files (a Windows
  user-choice exists for the extension): the action must still appear, so it is
  registered against the effective file type rather than the bare extension key
  (the shell ignores extension-key verbs in that case; verified 2026-08-09).
- The effective file type for an extension differs between machines and changes
  when the user picks a new default: the registration resolves the current
  effective file type at install time rather than assuming a fixed ProgID.
- A document has zero content or a single character: the editor canvas colour
  still fills the full editor region.
- The view-source icon in dark mode sits on a dark canvas: the dark blue must
  stay distinguishable, not merge into the background.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Installing the application through its Windows installer MUST add
  a native file-browser context-menu action bearing the product name for
  supported markdown files and folders, pointing at the installed executable.
- **FR-002**: Uninstalling the application through its installer MUST remove
  those actions.
- **FR-003**: Installing the application through the Scoop package manager MUST
  add the same context-menu action for supported markdown files and folders.
- **FR-004**: Uninstalling the application through Scoop MUST remove it.
- **FR-005**: The registered action MUST remain valid across Scoop version
  updates.
- **FR-006**: Registering or removing the action MUST NOT change the user's
  default application for markdown files or folders.
- **FR-007**: A failed register or remove during an install or uninstall MUST
  fail closed and MUST NOT corrupt unrelated file associations.
- **FR-008**: A manually unzipped portable archive MUST NOT register any
  context-menu action.
- **FR-009**: The context-menu label MUST derive from the same single product
  display name value as every other native action.
- **FR-010**: The action MUST be registered against the file type a file
  actually resolves to — the user-chosen default when one exists, otherwise the
  extension's class — so it appears even when the user has selected a different
  default application (registering under the bare extension key is insufficient
  when a user-chosen default exists; verified 2026-08-09).
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

- **Context-menu registration**: The per-user operating-system state that makes
  the product-named action appear for supported markdown files and folders,
  always pointing at the installed executable. It targets the effective file
  type of each supported extension (FR-010) and is created and removed only by
  the install channels — never by the application at runtime.
- **Editor canvas colour**: The theme's background palette value that fills the
  editing surface behind the document content.
- **View-source glyph**: The code-bracket-square icon used by the view-source
  action, rendered in a dark blue colour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of installer install→uninstall cycles on Windows, the
  product-named action appears and is then removed, and the user's default
  application is unchanged.
- **SC-002**: In 100% of Scoop install→uninstall cycles, the product-named
  action appears and is then removed, and the user's default application is
  unchanged.
- **SC-003**: In 100% of short-document tests across all five editor themes and
  both light and dark modes, the editor region shows the theme canvas colour
  edge to edge with no contrasting patch.
- **SC-004**: In 100% of visual checks across light and dark mode, the
  view-source action shows the code-bracket-square glyph in dark blue and is
  legible against the background.

## Assumptions

- **Registration is channel-owned**: The context-menu action is a property of
  how the application is installed, not an in-app setting. There is deliberately
  no settings switch or runtime registration: choosing the installer or Scoop is
  the user's opt-in, and each channel owns its own install/uninstall lifecycle.
  (This supersedes an earlier draft that proposed a Windows-only Settings
  toggle.)
- **Scoop uses the portable ZIP, not the NSIS installer**: Scoop's manifest
  installs the `windows-x64.zip` archive, so it has no installer to register
  with. Scoop therefore needs its own manifest hooks — an install-time step that
  registers (FR-003) and an uninstall-time step that removes (FR-004).
- **The NSIS installer already handles itself**: The Windows installer registers
  on install and removes on uninstall (spec 006, `scripts/installer.nsh`), which
  satisfies FR-001/FR-002. Note: the currently released installer (v0.1.0)
  registers the file verb under the bare extension key, which the shell ignores
  when a user-chosen default exists (verified 2026-08-09); the corrected
  effective-file-type registration (FR-010) fixes this for the next release.
- **Registration location**: The file verb is registered against the effective
  file type — the extension's user-chosen default (Windows user-choice) when one
  exists, otherwise the extension's class ProgID, otherwise the extension key —
  never the bare extension key alone (FR-010). Folders register under the
  directory class. Resolving the effective file type happens at install time,
  because it is per-user and changes when the user picks a new default.
- **The release `.exe` is the NSIS installer**: The published
  `markdownmeister-<version>-windows-x64.exe` is the installer; the
  `...-windows-x64.zip` is the portable binary. Versions released before this
  feature shipped do not register the action; it ships with the next release.
- **Portable archives register nothing** (FR-008): a manually unzipped ZIP has
  no uninstaller, so there is no reliable way to guarantee removal — it gets no
  action rather than a potentially stale one.
- **Platform behaviour elsewhere**: On macOS the Finder "Open With…" action is
  declared in the application bundle and is always present; it cannot be toggled
  at runtime. Linux has no OS file-browser integration (out of scope, spec 006).
- **Folder entries**: Files and folders are registered together, matching the
  installer's existing scope.
- **Dark blue**: "Dark blue" is a single curated colour distinct from the
  accent token, chosen so it reads clearly on both light and dark canvases
  (FR-015); the exact value is a plan-level decision.
- **Carry-over fixes**: The editor-canvas and view-source icon issues were part
  of the settings-redesign feature's original input but were not fully
  delivered; this spec covers them explicitly so their completion is verifiable.
