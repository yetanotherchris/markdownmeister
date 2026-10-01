# Feature Specification: Project Site Rebuild

**Feature Branch**: `spec-062-windows-store-distribution`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "the current GitHub Pages site is a placeholder; copy the app-20-desktop setup for GitHub Pages."

## Context

The project site served by GitHub Pages was delivered by spec 040 as a single hand-written HTML page with compiled CSS, deployed verbatim with no build step. Its hero art is a placeholder and its content is thin. The user wants a proper project site matching the structure and build/deploy approach used by the `app-20-desktop` repository: a built single-page site with a header, sidebar navigation, hero, feature and documentation sections, a searchable reference table, and a footer, deployed to GitHub Pages from a built output directory.

This supersedes spec 040's "no build step at deploy time" decision (spec 040 research D3). It also has to keep serving the Store privacy policy at a stable URL, because spec 062's Microsoft Store listing references `https://yetanotherchris.github.io/markdownmeister/privacy.html`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor understands the product (Priority: P1)

Someone arriving from a release, the Store, or a search reads what MarkdownMeister is, what it does, and how to install it, without placeholder art or dead links.

**Why this priority**: The site is the project's public face; the current placeholder misrepresents it.

**Independent Test**: Load the deployed site and confirm the hero, feature list, and install instructions present real content and every link resolves.

**Acceptance Scenarios**:

1. **Given** the site is deployed, **When** a visitor loads the home page, **Then** the hero names MarkdownMeister and a real description, not placeholder text or art.
2. **Given** the home page, **When** the visitor reads the install section, **Then** the Microsoft Store, Homebrew, and Scoop options are described with correct commands and links.
3. **Given** the home page, **When** the visitor uses the sidebar navigation, **Then** each entry moves to its section and the header search filters the reference table.

### User Story 2 - The site documents behaviour that matches the app (Priority: P1)

The documented features, folder actions, shortcuts, and settings match what the application actually does.

**Why this priority**: Documentation that contradicts the app is worse than none.

**Independent Test**: Compare each documented shortcut and folder-action statement against `src/main/shortcuts.ts` and the app's own behaviour.

**Acceptance Scenarios**:

1. **Given** the shortcuts reference, **When** it lists an accelerator, **Then** the accelerator matches `src/main/shortcuts.ts`.
2. **Given** the folder-action section, **When** it describes Windows, **Then** it states the Windows 11 first-level menu for the Store build, the "Show more options" entry for the classic channels, and the Windows 10 in-app Open Folder path.

### User Story 3 - The privacy policy stays reachable (Priority: P1)

The Microsoft Store listing's privacy URL continues to resolve after the rebuild.

**Why this priority**: A broken privacy link fails Store certification and spec 062 depends on it.

**Independent Test**: Fetch `https://yetanotherchris.github.io/markdownmeister/privacy.html` after deploy and confirm it serves the policy.

**Acceptance Scenarios**:

1. **Given** the site is deployed, **When** the privacy URL is requested, **Then** it returns the privacy policy page, not a 404 or a client-side route shell.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST present a header, sidebar navigation, a hero, feature, install, folder-action, reference, and footer content, in the structure used by the `app-20-desktop` documentation site.
- **FR-002**: The site MUST be produced by a build step from source under `docs/site/`, and the deployed artifact MUST be the build output, not the source tree.
- **FR-003**: The deployed site MUST load no third-party stylesheet, script, or font; only the project's own built assets.
- **FR-004**: The privacy policy MUST remain reachable at `https://yetanotherchris.github.io/markdownmeister/privacy.html` as a static page.
- **FR-005**: The site MUST show the current release version, sourced from the release tag at deploy time and refreshed from the repository's release metadata where available.
- **FR-006**: The site MUST link to the Microsoft Store, the GitHub releases, and the repository, and MUST state that the Explorer folder action requires Windows 11.
- **FR-007**: The documented keyboard shortcuts and folder-action behaviour MUST match the application.
- **FR-008**: The GitHub Pages deployment MUST build the site and deploy its output on pushes to `main` that change the site sources or the workflow.
- **FR-009**: The site sources MUST be covered by the existing lint, typecheck, and format gates.

### Key Entities

- **Site source**: the files under `docs/site/` that the build consumes.
- **Build output**: the generated static artifact deployed to Pages (`docs/site/dist`).
- **Release version**: the latest release tag, shown in the site chrome.

## Success Criteria *(mandatory)*

- **SC-001**: A visitor can identify what the app is and how to install it from the home page alone, with no placeholder art or text.
- **SC-002**: Every documented shortcut matches `src/main/shortcuts.ts`.
- **SC-003**: The privacy URL returns the policy page after a deployment.
- **SC-004**: The deployment rebuilds and republishes on a site-source change and leaves the site working.
- **SC-005**: The built site requests no third-party resource.

## Assumptions

- The site is a single built page with in-page anchors and a client-side search filter, matching the `app-20-desktop` pattern; it is not a multi-route application.
- Real screenshots are maintainer-provided; until they exist the site uses no screenshot rather than placeholder art (spec 040 FR-005's concern).
- The `docs/site/` source and build are added to the existing single-package repository; no workspaces are introduced.
- Superseding spec 040's no-build decision is intentional and recorded in this feature's plan and research.
