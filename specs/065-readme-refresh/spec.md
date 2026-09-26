# Feature Specification: Project README Refresh

**Feature Branch**: `065-readme-refresh`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Update the README to have a clear and concise description, not overly detailed and includes installation options (terminal and app stores), and screenshot, and logo at the top"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the app at a glance (Priority: P1)

A developer lands on the project's repository page and, within a few seconds, sees the logo, a short plain description of what the app is, and a screenshot of it in use. They can tell whether it is the kind of editor they are looking for without reading paragraphs.

**Why this priority**: The README is the project's front door; if a visitor cannot tell what the app is almost immediately, nothing else on the page matters.

**Independent Test**: Show the top of the rendered README to someone unfamiliar with the project and confirm they can state what it does after a brief look.

**Acceptance Scenarios**:

1. **Given** the repository page, **When** the visitor looks at the top of the README, **Then** they see the project logo, the product name, and a concise description.
2. **Given** the concise description, **When** the visitor reads it, **Then** it states what the app is (a WYSIWYG markdown editor) without going into implementation or history.
3. **Given** the top of the README, **When** the visitor scans it, **Then** a screenshot of the running application is visible near the top.
4. **Given** the whole README, **When** the visitor scrolls, **Then** no section is a wall of text; details are brief and deeper material is linked rather than inlined.

---

### User Story 2 - Install the app from the README (Priority: P1)

A user who wants the app can find the installation option that matches them: a terminal install (Homebrew on macOS/Linux where available, Scoop on Windows) or an app store (Microsoft Store on Windows, Flathub and the Snap Store on Linux, and the signed download on macOS), with copyable and correct commands and links.

**Why this priority**: The README's job is to turn interest into a working install; wrong or missing commands are the most damaging kind of README error.

**Independent Test**: Follow each platform's README instructions from a clean environment and confirm the app installs and launches, or, where a channel is not yet published, that the README says so and offers the working alternative.

**Acceptance Scenarios**:

1. **Given** the README, **When** a macOS or Linux user follows the terminal instructions, **Then** they find a command that actually works for their platform, or, while the Homebrew tap does not exist, a clear pointer to the releases page instead of a failing command.
2. **Given** the README, **When** a Windows user follows the terminal instructions, **Then** they find the correct Scoop command and it works.
3. **Given** the README, **When** a user prefers an app store, **Then** each available store is listed with the correct link or command.
4. **Given** a store that is not yet published, **When** the user reads that entry, **Then** it is clearly marked as such rather than presenting a dead command.
5. **Given** every command or link in the README, **When** it is used, **Then** it is current and correct for the latest release, or explicitly marked as not yet available.

---

### User Story 3 - Trust the visual identity (Priority: P2)

The README uses the real product logo and a real screenshot, sized appropriately and with descriptive alternative text, so the page looks finished and works for screen readers and in both GitHub themes.

**Why this priority**: Placeholder artwork on the front page makes a project look abandoned; a finished look is part of installability.

**Independent Test**: View the rendered README in GitHub light and dark themes and with images loaded from the repository, and check alt text.

**Acceptance Scenarios**:

1. **Given** the README, **When** it renders, **Then** the logo and screenshot load from files in the repository (not external hosts) and display at a sensible size.
2. **Given** the screenshot, **When** it is inspected, **Then** it shows the real application and has descriptive alternative text.
3. **Given** GitHub's light and dark themes, **When** the README is viewed, **Then** both render legibly.
4. **Given** the README, **When** a link or image is checked, **Then** none is broken.

---

### Edge Cases

- A store listed in the README is not yet live: the entry must say so clearly and not present a command that fails.
- The Homebrew tap does not exist: the README must not show a working-looking brew command; it points at the releases page until the tap is published.
- The Homebrew command depends on a tap, and the Scoop command depends on a bucket: the README must include the setup step, not just the install line.
- The screenshot is large: it must be sized so it does not dominate the page or slow loading on the repository page.
- The app is renamed or a store link changes: the README must be updated as part of the release/feature that changes it, so it never drifts. Each store spec owns the update of its own README entry at launch.
- The current README contains a section mislabelled for the wrong platform: the refresh must correct it.
- macOS may still show a security warning until notarization ships: the README must describe the current state accurately and not tell users to bypass warnings.
- Deep feature detail is desired by some readers: it belongs in the website or linked docs, not inlined in the README.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The README MUST show the product logo at the top.
- **FR-002**: The README MUST open with a concise description of the app suitable for a non-technical reader, and MUST NOT be a long feature essay.
- **FR-003**: The README MUST include a real screenshot of the running application near the top, with descriptive alternative text.
- **FR-004**: The README MUST list terminal installation options with correct, copyable commands and any required source setup. A Homebrew command MUST be presented as working ONLY if its tap exists and the command is verified; until the tap is published, the README MUST direct macOS/Linux users to the releases page instead of showing a command that fails. The Scoop path (bucket: this repository) MUST be verified.
- **FR-005**: The README MUST list available app-store installation options where the app is published (Microsoft Store, Flathub, Snap Store) plus the signed macOS download, each with the correct link or command.
- **FR-006**: Platform headings and labels MUST be correct; the current mislabelled macOS/Linux section that shows a Windows command MUST be fixed.
- **FR-007**: Store entries that are not yet live MUST be clearly marked as forthcoming rather than offering a failing command. Each store specification (062-064) MUST update its README entry to the verified link or command as part of that store going live, so no entry is left pending after launch.
- **FR-008**: Every command and link in the README MUST resolve and be current for the latest release.
- **FR-009**: The README MUST remain short: each section a brief paragraph or a short code block, with deeper material linked to the project site or documentation.
- **FR-010**: The README MUST link to the releases page, the licence, and the project site.
- **FR-011**: The logo and screenshot MUST be files stored in the repository and referenced by relative path, and MUST render correctly in GitHub's light and dark themes.
- **FR-012**: The README MUST NOT instruct users to bypass operating-system security warnings; where a warning is expected (for example, before macOS notarization ships), it is stated accurately.
- **FR-013**: The README MUST describe the macOS download accurately for the state at the time: before notarization ships it MUST state that macOS may show a security warning and how to proceed without misrepresenting the app, and after a verified notarized release it MUST present the download as warning-free.
- **FR-014**: The screenshot MUST be a real capture stored in the repository (in the existing site assets directory or an equivalent committed assets directory) and referenced by relative path. Updating the marketing site's own placeholder screenshot is out of scope for this feature but MUST be noted so it is not forgotten.

### Key Entities *(include if feature involves data)*

- **Logo**: The product icon used at the top of the README, sourced from the repository.
- **Screenshot**: A real image of the application in use, stored in the repository with alternative text.
- **Installation option**: One platform-appropriate way to obtain the app, either a terminal command or a store listing, with its own correct syntax or link.
- **Store availability**: Whether a given store entry is live or forthcoming; shown honestly in the README and updated by the store's own specification when it launches.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newcomer can state what the app does after a ten-second look at the top of the README.
- **SC-002**: A user can find and start the correct install method for their platform in under 30 seconds.
- **SC-003**: In 100% of checks, the documented install commands and links work against the latest release, or are explicitly marked as not yet available.
- **SC-004**: The README shows both the logo and a screenshot before any deep detail.
- **SC-005**: No README section exceeds a short paragraph or a short code block; the page reads as concise.
- **SC-006**: No broken links or images in the README, verified in both GitHub themes.
- **SC-007**: No README store entry remains marked forthcoming after that store has published; each store's launch updates its README entry as part of that store's own delivery.

## Assumptions

- **Logo source**: The existing application icon is the logo; a separate wordmark is not required.
- **Real screenshot required**: A placeholder image is not acceptable in the README; a real screenshot of the app is captured for this feature and committed under the repository's site assets directory.
- **Homebrew tap prerequisite**: The archived release spec (005) records that the required Homebrew tap repository was never created. The README must not present a working brew command until it exists; creating the tap is a prerequisite tracked by the release work, not by this README change. Until then macOS/Linux terminal users are pointed at the releases page.
- **Store links depend on delivery**: The Microsoft Store, Flathub, and Snap Store entries are written against specs 062-064. Until each is live, the README marks it as forthcoming; the corresponding store spec is responsible for replacing that entry when it launches (FR-007).
- **macOS download**: The README links to the signed, notarized download (spec 063) only once that has shipped; before then it describes the current unsigned download accurately, since the Mac App Store is deferred.
- **Scope**: This feature changes the README and adds its image assets. The marketing site has its own sources and is out of scope, though the note about its placeholder screenshot is recorded (FR-014).
- **Tone**: The README is written plainly, without marketing filler, matching the project's existing documentation style.

## Clarifications

### 2026-09-26 (during specification)

- **Concision is a requirement**: The user explicitly asked for a clear and concise description that is "not overly detailed", so FR-002/FR-009 make brevity testable rather than aspirational.
- **Terminal and stores**: The user asked for installation options covering both terminal commands and app stores; the specific stores come from specs 062 (Microsoft Store) and 064 (Flathub, Snap Store), with the signed macOS download from spec 063.
- **Logo and screenshot**: The user asked for both, with the logo at the top; a real screenshot is required, not placeholder art.

### 2026-09-26 (revision after independent review)

- **Homebrew tap dependency made explicit**: FR-004 and the assumptions now state that a working brew command is only shown once the missing tap exists, with the releases page as the honest fallback until then.
- **macOS state made accurate over time**: FR-013 distinguishes the README's wording before and after notarization ships, so it never claims a warning-free download that does not exist yet.
- **Store-entry handoff is owned and enforceable**: FR-007 and SC-007 make each store spec responsible for replacing its own forthcoming README entry at launch, so a published store cannot be left with a placeholder entry.
- **Screenshot storage defined**: FR-014 names a committed assets location and records the marketing site's placeholder as out-of-scope but tracked.
