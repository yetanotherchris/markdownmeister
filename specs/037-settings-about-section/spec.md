# Feature Specification: Settings About Section

**Feature Branch**: `037-settings-about-section`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "the settings menu needs an about section, with the version and the url of the repo, and a hash"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The user can see what build they are running (Priority: P1)

A user who opens the application's settings finds an About section alongside the existing settings areas. It shows the version of the installed application, the public URL of the project's source repository, and the source revision identifier of the exact build they are running. All three are visible at a glance, in one place, without leaving the dialog.

**Why this priority**: Answering "what am I running?" is the entire point of the feature; everything else is refinement.

**Independent Test**: Open settings, switch to About, and confirm three values are displayed: a version matching the installed release, the repository URL, and a revision identifier.

**Acceptance Scenarios**:

1. **Given** any installed release of the application, **When** the user opens settings and selects the About area, **Then** the displayed version matches the installed release's version exactly.
2. **Given** the About area is open, **When** the user inspects its content, **Then** it displays the repository URL `https://github.com/yetanotherchris/markdownmeister` and a source revision identifier for the running build.
3. **Given** the settings dialog opens on General as today, **When** the user looks at the navigation, **Then** an entry labelled "About" exists alongside the other areas, and selecting it shows only read-only information.

---

### User Story 2 - The values are actionable for support and bug reports (Priority: P2)

The repository URL behaves like a link: activating it opens the repository in the system's default web browser, outside the application. The revision identifier is selectable and copyable so a user filing a bug report can paste the exact build information without retyping it.

**Why this priority**: The hash exists to be reported; making it copyable and making the link external is what turns static text into something useful.

**Independent Test**: Activate the repository link and confirm the browser opens to the repository page; select-and-copy the revision text into another application and confirm it pastes unchanged.

**Acceptance Scenarios**:

1. **Given** the About area is open, **When** the user activates the repository URL, **Then** the system default browser opens at the repository page and nothing changes inside the application window.
2. **Given** the About area is open, **When** the user selects the revision identifier and copies it, **Then** the copied value is the full, untruncated identifier.
3. **Given** the machine has no network connection, **When** the user activates the repository URL, **Then** the attempt is handed to the operating system as usual and the application itself shows no error.

---

### Edge Cases

- A development or unpackaged run that carries no embedded release metadata: the About area shows an honest placeholder (for example "development build") rather than a fabricated or stale version or revision value.
- Very long revision identifiers: displayed in full (wrapping if necessary) so no character is hidden from someone reading or copying it.
- Clipboard operations unavailable or denied by the environment: selection remains possible; the failure does not produce an error dialog.
- Extremely narrow window sizes: all three values remain readable through normal layout flow within the dialog.
- Repeated activation of the repository link: each activation hands off once; the application never opens multiple internal views or duplicates state.
- The user edits nothing in this area: there is no unsaved state here, so closing the dialog never prompts about About-area content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The settings dialog MUST include a dedicated About area, labelled "About", reachable from the same navigation used for the existing settings areas.
- **FR-002**: The About area MUST display the installed application's version, sourced from the same build metadata the release process publishes (a single source of truth; never hand-maintained).
- **FR-003**: The About area MUST display the project repository URL `https://github.com/yetanotherchris/markdownmeister`.
- **FR-004**: Activating the repository URL MUST open it in the system default browser as an external hand-off; it MUST NOT open inside the application or navigate any in-application view.
- **FR-005**: The About area MUST display a source revision identifier identifying the exact revision the running build was produced from.
- **FR-006**: The revision identifier MUST be user-selectable and copyable in full.
- **FR-007**: Version and revision values MUST come from build-time metadata embedded in the application; when such metadata is absent (development runs), the area MUST show an explicit development-build placeholder instead of incorrect values.
- **FR-008**: The About area MUST contain no adjustable settings; its presence MUST NOT change the staged-save behaviour, validation, or layout behaviour of the other areas, and closing the dialog after viewing it MUST never prompt about unsaved changes.
- **FR-009**: All displayed values MUST be consistent with what the release artifacts report for the same build — a user comparing the About panel against the published release must never find a contradiction.

### Key Entities *(include if feature involves data)*

- **Build identity**: The trio of values describing a running build — version, repository URL, source revision identifier — embedded at build time from a single authoritative source.
- **About area**: The read-only settings area presenting the build identity; participates in navigation like other areas but holds no adjustable state.
- **External hand-off**: The pattern of giving a URL to the operating system to open in the default browser rather than rendering it in-application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of packaged-release tests, the version shown in About equals the published version of the artifact being tested.
- **SC-002**: In 100% of release builds, the displayed revision identifier matches the actual source revision the artifact was built from (verified by rebuilding from that revision).
- **SC-003**: In 100% of link-activation tests on Windows, macOS, and Linux, the repository page opens in the default browser with zero in-application side effects.
- **SC-004**: Copying the revision identifier yields the complete value in 100% of tested attempts, with no truncation or whitespace surprises.
- **SC-005**: In 100% of unpackaged/development-run tests, About shows the development placeholder and never displays a wrong version or wrong revision.

## Assumptions

- **Hash meaning**: "A hash" is interpreted as the source-revision identifier (the commit the running build was produced from), not a checksum of downloaded artifacts.
- **Full identifier**: The full revision identifier is displayed rather than an abbreviated form, maximising usefulness in bug reports; truncation can be revisited later without changing the contract.
- **Repository URL constancy**: The URL ships as constant build metadata; if the repository ever moves, updating it is part of the release process, not a runtime concern.
- **Placement**: About appears as the last entry in the settings navigation, after Markdown.
- **Scope**: Exactly the three requested values are shown — version, repository URL, revision identifier. Licences, credits, update channels, and telemetry status are out of scope until separately specified.
