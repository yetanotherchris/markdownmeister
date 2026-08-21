# Feature Specification: Scoop Start Menu Shortcut

**Feature Branch**: `034-start-menu-shortcut`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "Can scoop setup shortcuts in Windows? so a start menu shortcut" — asked after observing that a Scoop-installed MarkdownMeister puts no entry in the Start Menu, while the Windows installer does.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch MarkdownMeister from the Start Menu (Priority: P1)

A Windows user installs the application with the documented Scoop command. When installation finishes, the application appears in the Start Menu under its product name, and choosing it launches the editor directly — no terminal, no package-manager command, no browsing into the install folder.

**Why this priority**: This is the feature. Without it, Scoop users must remember an executable path or a shell command to open their markdown editor, which installer users never have to do.

**Independent Test**: On a clean Windows machine, run the documented Scoop install command, open the Start Menu, find the MarkdownMeister entry, and click it; the editor window opens.

**Acceptance Scenarios**:

1. **Given** a clean Windows environment with the project's Scoop bucket added, **When** the user runs the documented install command, **Then** a Start Menu entry named "MarkdownMeister" exists once installation completes.
2. **Given** an installed application, **When** the user chooses the Start Menu entry, **Then** the editor window opens without any console window or additional input.
3. **Given** the Start Menu entry, **When** it is viewed in the Start Menu or taskbar after launching, **Then** it shows the application's own icon rather than a generic placeholder.

---

### User Story 2 - Shortcut stays correct across updates and removal (Priority: P2)

Users who update or uninstall through Scoop keep a consistent Start Menu state: updating keeps the entry working against the newly installed version, and uninstalling removes the entry entirely.

**Why this priority**: A shortcut that survives uninstall as a dead link, or breaks after the first update, is worse than no shortcut — it erodes trust in the package.

**Independent Test**: Install a version, update to a later release and launch from the Start Menu (the new version runs), then uninstall and confirm the Start Menu entry is gone.

**Acceptance Scenarios**:

1. **Given** an installation made before this feature existed, **When** the user updates to the first release that declares the shortcut, **Then** the Start Menu entry appears and launches the updated version.
2. **Given** an installation that already has the Start Menu entry, **When** the user updates to any later release, **Then** the entry still exists and launches the updated version.
3. **Given** an installed application with its Start Menu entry, **When** the user uninstalls through Scoop, **Then** the Start Menu entry no longer exists.

---

### User Story 3 - Releases keep the shortcut declaration (Priority: P3)

A maintainer cutting a new release does not have to re-add the shortcut declaration by hand: the automated release-time update of the Scoop package definition changes only what the new release requires (version, download location, checksum) and leaves the shortcut declaration intact.

**Why this priority**: The declaration lives in a file that release automation rewrites every release. If the automation dropped it, the feature would silently regress for all future versions — exactly the kind of failure users notice before maintainers do.

**Independent Test**: Run the manifest-update step against a prepared artifact for a new version and confirm the resulting package definition still contains an unchanged shortcut declaration.

**Acceptance Scenarios**:

1. **Given** the current Scoop package definition containing the shortcut declaration, **When** the release process updates it for a new version, **Then** the shortcut declaration remains present and unchanged in the committed result.
2. **Given** any released version of the repository, **When** its Scoop package definition is inspected, **Then** the shortcut declaration is present.

---

### Edge Cases

- An existing installation predating this feature has no Start Menu entry until its next update through Scoop; no separate migration step is provided, and this is acceptable because updates are the normal flow.
- A global (all-users) Scoop installation places its Start Menu entry where the package manager puts global entries; per-user installations place theirs in the user's Start Menu. Both are standard package-manager behaviour and neither requires project-specific handling.
- The application executable carries its own embedded icon; if a future packaging change removed it, the Start Menu entry would fall back to a generic icon rather than failing to launch.
- A user who deletes the Start Menu entry manually gets it back on the next update; the package treats the declaration as the source of truth, not any particular machine's Start Menu state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Scoop package definition MUST declare a Start Menu shortcut whose target is the packaged application executable.
- **FR-002**: The Start Menu entry MUST be displayed under the human-facing product name "MarkdownMeister".
- **FR-003**: Choosing the Start Menu entry MUST start the desktop application directly, with no console window and no required arguments.
- **FR-004**: The Start Menu entry MUST present the application's own icon.
- **FR-005**: Both installing and updating through Scoop MUST leave the user with a working Start Menu entry for the installed version.
- **FR-006**: Uninstalling through Scoop MUST remove the Start Menu entry.
- **FR-007**: The release-time update of the Scoop package definition MUST preserve the shortcut declaration without manual intervention.

### Key Entities

- **Shortcut declaration**: The part of the Scoop package definition that describes the Start Menu entry — target executable, display name, and optionally arguments and icon. It is declared once and carried forward by release automation.
- **Start Menu entry**: What Windows shows the user: a named, icon-bearing item that launches the installed application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of clean-install tests on supported Windows environments, the documented Scoop command produces a Start Menu entry that launches the editor.
- **SC-002**: In 100% of update tests from both pre-feature and post-feature versions, the Start Menu entry exists afterwards and launches the updated version.
- **SC-003**: In 100% of uninstall tests, no Start Menu entry remains afterwards.
- **SC-004**: In 100% of release-regeneration tests, the shortcut declaration survives the package-definition update unchanged.

## Assumptions

- **Display name**: "MarkdownMeister" matches the packaged product name used everywhere else (installer shortcuts, window title); no alternative spelling is introduced.
- **Icon source**: The declaration relies on the executable's embedded icon rather than pinning a separate icon file, avoiding a second asset whose path could break.
- **Placement**: The package manager's standard Start Menu placement (its own apps folder) is accepted; custom Start Menu folders are out of scope.
- **Platform scope**: Scoop serves Windows only. macOS and Linux distribution is unaffected, and the NSIS installer already creates its own shortcuts — nothing about it changes here.
- **Rollout**: Existing users receive the entry on their next update; no announcement or migration tooling is required.
- **Verification**: As with spec 005's package definitions, Scoop installation behaviour cannot be exercised by the Playwright e2e suite; verification is manual against real built artifacts via the feature quickstart, plus automated coverage for whatever the repository can test directly (for example, manifest shape and release-regeneration preservation).
