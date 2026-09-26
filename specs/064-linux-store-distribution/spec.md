# Feature Specification: Linux Store Distribution (Flathub and Snap Store)

**Feature Branch**: `064-linux-store-distribution`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "I want the app to be available through the equivalent Linux (i'm not sure what stores are available, please confirm)". The two relevant stores are Flathub (cross-distribution Flatpak) and the Snap Store (Ubuntu/Canonical); both are in scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install from Flathub through a software centre (Priority: P1)

A Linux user opens their distribution's software centre (GNOME Software, KDE Discover, or equivalent), searches for MarkdownMeister, and installs it from Flathub. The app appears with its icon and description, installs sandboxed, and launches from the application menu.

**Why this priority**: Flathub is the closest thing to a universal Linux app store; a distribution-agnostic listing is the main way Linux users expect to install desktop apps.

**Independent Test**: On a distribution with Flathub enabled, install the app from the software centre or `flatpak install`, launch it, and open a folder.

**Acceptance Scenarios**:

1. **Given** a distribution with Flathub configured, **When** the user searches the software centre, **Then** MarkdownMeister is found with its icon, name, and summary.
2. **Given** the listing, **When** the user installs, **Then** the app installs without elevated system changes beyond the store's normal behaviour (per-user install accepted).
3. **Given** the app is installed, **When** the user launches it from the application menu, **Then** it opens and can open a folder and edit markdown files.
4. **Given** the Flathub app is installed, **When** an update is released, **Then** the store offers and applies it.

---

### User Story 2 - Install from the Snap Store (Priority: P1)

An Ubuntu user installs the app with a single `snap install` command or from the Snap Store in their desktop, and launches it from the application menu.

**Why this priority**: The Snap Store is the default store on Ubuntu, the largest Linux desktop base, and a second store broadens reach without replacing Flathub.

**Independent Test**: On a stock Ubuntu machine, run the documented snap install command, launch the app, and open a folder.

**Acceptance Scenarios**:

1. **Given** a stock Ubuntu machine with snapd, **When** the user runs `snap install markdownmeister`, **Then** the app installs and appears in the application menu.
2. **Given** the snap is installed, **When** the user launches it, **Then** it opens and can open a folder and edit markdown files.
3. **Given** the snap is installed, **When** a new revision is released to the stable channel, **Then** the snap refreshes automatically.
4. **Given** the store listing, **When** the user reads it, **Then** name, summary, description, screenshots, icon, and licence are present.

---

### User Story 3 - The sandboxed store builds keep the app working (Priority: P1)

Even though both stores run the app inside a sandbox, the core experience is intact: opening a workspace folder, reading and writing markdown inside it, file and folder association where the desktop supports it, and the app's path containment guarantees.

**Why this priority**: A store listing that installs an app whose central feature (opening a folder) is broken is worse than not shipping to that store; the sandbox must be configured to permit exactly what the app needs.

**Independent Test**: In each store build, open a folder chosen by the user, edit and save a file, exercise the folder Open With entry, and run the adversarial path checks; confirm no file outside the workspace is touched.

**Acceptance Scenarios**:

1. **Given** the sandboxed store build, **When** the user opens a folder they select, **Then** the folder becomes the workspace and its markdown files can be read and saved.
2. **Given** the sandboxed store build, **When** the user edits and saves a file in the workspace, **Then** the save is atomic and the dirty state clears exactly as in the other channels.
3. **Given** the sandboxed store build, **When** a folder is handed over from the file manager, **Then** it is treated as an untrusted external path and validated as in every other channel, failing closed outside the workspace.
4. **Given** the sandboxed store build, **When** the user never grants access to anything outside the workspace, **Then** the app cannot read or write outside it.
5. **Given** the desktop supports a folder Open With entry, **When** the store build registers it, **Then** it works and never becomes the default folder handler; where the desktop does not support it, the app still opens folders normally.

---

### User Story 4 - Stores, updates, and removal stay independent (Priority: P2)

A user may install the Flatpak, the snap, or the direct-download AppImage. Each works, each updates through its own mechanism, and removing one leaves the others intact with no dead entries.

**Why this priority**: Multiple Linux channels must not interfere, matching the channel-isolation rule already applied to the other platforms.

**Independent Test**: Install two channels side by side, verify both launch and update independently, then remove one and confirm the other still works.

**Acceptance Scenarios**:

1. **Given** two channel builds installed, **When** each is launched, **Then** both work independently.
2. **Given** the Flatpak is removed, **When** the snap and AppImage are inspected, **Then** they are unaffected and functional.
3. **Given** a store build is uninstalled, **When** the application menu and Open With entries are inspected, **Then** no entry for the removed build remains.
4. **Given** both stores are published, **When** a new version is released, **Then** each store updates on its own schedule without breaking the other.

---

### User Story 5 - Maintainers can ship updates without heroics (Priority: P2)

The maintainer can publish each new app version to both stores through a repeatable process: a manifest under version control for Flathub, and a build-and-publish path for the Snap Store that can run from CI.

**Why this priority**: A one-time listing that cannot be updated would quickly become a stale, misleading store page.

**Independent Test**: Perform an update release against both stores using the documented process and confirm the new version is published in each.

**Acceptance Scenarios**:

1. **Given** a new release, **When** the Flathub manifest is updated and merged, **Then** the new version builds and publishes through Flathub's automated build.
2. **Given** a new release, **When** the snap build runs, **Then** the new revision is uploaded and released to the stable channel.
3. **Given** no network is available during the Flathub build, **When** it runs, **Then** it still succeeds because all sources are declared in the manifest.
4. **Given** a store build fails, **When** the release ends, **Then** the direct-download AppImage and the other store are unaffected.

---

### Edge Cases

- The Flatpak sandbox is too restrictive: the app must request only the permissions it needs, and folder access must work through the store's normal permission model.
- Wayland versus X11: the app must launch on both, with whichever display backend the store configuration selects.
- The desktop does not support third-party folder Open With entries: the app must still open folders through its own controls; no broken menu entry is left behind.
- A folder outside the user's home is opened: the sandbox must allow it only through the user's explicit choice, never silently.
- The snap uses strict confinement: any interface it needs (home, etc.) must be declared and justified; classic confinement is avoided unless unavoidable.
- Flathub review requests changes or rejects the submission: the submission is reworked without changing the app's behaviour or the other channels.
- A snap revision is released to the wrong channel: only stable is user-facing; edge and beta are for testing.
- The licence and metadata are missing or wrong: submission must be corrected before the store builds are considered done.
- The stores lag the GitHub release: users on a store get the new version later, which is accepted and documented.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be published to Flathub as a Flatpak under a stable reverse-domain application identifier.
- **FR-002**: The application MUST be published to the Snap Store under a stable snap name, installable on a stock Ubuntu machine.
- **FR-003**: Both store listings MUST present the product name, a summary, a description, screenshots, the product icon, the licence, and the project homepage.
- **FR-004**: Both store builds MUST be the same application version as the corresponding release, and MUST report that version in the app.
- **FR-005**: Each store build MUST update through its own store mechanism without manual reinstall.
- **FR-006**: Each sandboxed store build MUST be able to open a user-chosen folder and read, edit, and atomically save files within it, using the minimum permissions required.
- **FR-007**: Paths handed to the app from outside MUST continue to be treated as untrusted and validated in the main process, failing closed outside the workspace (Principle II).
- **FR-008**: Store builds MUST NOT be able to read or write files outside the user-chosen workspace except where the user explicitly grants access through the platform's normal mechanism.
- **FR-009**: Where the desktop supports a folder Open With entry, the store build MUST provide it and MUST NOT become the default folder handler; where it does not, the app MUST still open folders, and no broken entry may remain.
- **FR-010**: Store channels MUST coexist with each other and with the direct-download AppImage; each MUST update and be removable independently, leaving the others working.
- **FR-011**: The Flathub manifest and its metadata MUST live under version control and MUST declare all sources so the build succeeds without network access.
- **FR-012**: The Snap Store build and publish path MUST be runnable from CI and MUST keep its credentials out of the repository.
- **FR-013**: A failure in one store channel MUST NOT block or alter the direct-download release or the other store channel.
- **FR-014**: The README MUST document installing from Flathub and the Snap Store, alongside the existing terminal install.
- **FR-015**: Any restricted permission or interface declared by a store build MUST be justified, and no unused capability may be declared.

### Key Entities *(include if feature involves data)*

- **Flatpak manifest**: The versioned build description published to Flathub, including the application identifier, runtime, permissions, and all sources.
- **Snap package**: The versioned snap built for and published to the Snap Store, with its declared interfaces and channel.
- **Store listing**: The public store page (name, summary, description, images, licence) users see before installing.
- **Sandbox permission**: A capability granted to a store build, chosen to be the minimum that keeps the app's folder-based editing working.
- **Channel independence**: The rule that each Linux channel installs, updates, and is removed without affecting the others.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Linux user can find and install the app from Flathub through a software centre in under two minutes.
- **SC-002**: `snap install markdownmeister` succeeds on a stock Ubuntu machine and the app launches from the application menu.
- **SC-003**: In 100% of sandbox feature checks, opening a folder, editing, and saving within it work in both store builds.
- **SC-004**: In 100% of adversarial path checks, a store build does not read or write outside the chosen workspace.
- **SC-005**: A new release appears in both stores through their automated processes with no manual rebuild by the user.
- **SC-006**: In 100% of removal tests, uninstalling one channel leaves the others installed, launchable, and correctly registered.
- **SC-007**: Both store listings pass their store's metadata and licence checks before publication.

## Assumptions

- **Chosen stores**: Flathub (Flatpak) and the Snap Store are the two Linux stores in scope, confirmed with the maintainer. The AppImage direct download remains available and is not replaced.
- **Two stores are complementary**: Flathub serves most distributions; the Snap Store serves Ubuntu and other snap-enabled distributions. Shipping both is deliberate, not redundant.
- **Sandboxing is expected**: Both stores sandbox apps. The app will request the minimum permissions (home or user-selected file access) needed for its folder-based editing, and the exact mechanism is settled in planning.
- **Flathub hosting model**: Flathub builds from a manifest in a dedicated repository and requires an upstream submission pull request; updates are pull requests that trigger automated builds. The maintainer owns that repository.
- **Snap hosting model**: The Snap Store requires registering the snap name under a publisher account; builds can be produced in CI and released to stable.
- **Architecture scope**: The initial store builds target x64, matching the current Linux release; other architectures are out of scope.
- **Update latency**: Store review and build queues mean store versions can lag the GitHub release; this is accepted and documented.
- **Verification**: Automated tests cover the app-level path and save behaviour; the actual store install, sandbox permission prompts, and desktop integration are verified manually on real Linux machines and in the stores' own review environments.

## Clarifications

### 2026-09-26 (during specification)

- **Linux stores confirmed**: The maintainer asked what stores were available. The answer given was that Linux has no single universal store; the practical equivalents are Flathub (cross-distribution Flatpak) and the Snap Store (Ubuntu/Canonical), while the AppImage is a direct download rather than a store. The maintainer chose to target both Flathub and the Snap Store.
- **Folder access under sandbox**: Because opening arbitrary folders is the app's central feature, the sandbox permissions needed to preserve it are treated as a first-class requirement (US3, FR-006/FR-008) rather than an implementation detail.
- **Channel independence**: Both stores coexist with the AppImage and each other; the direct-download channel is unchanged by this feature.
