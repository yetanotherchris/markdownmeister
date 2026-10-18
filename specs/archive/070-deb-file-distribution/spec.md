# Feature Specification: Debian Package Distribution (No Flathub)

**Feature Branch**: `070-deb-file-distribution`

**Created**: 2026-10-17

**Status**: Archived

**Input**: User description: "I think .deb makes most sense?" and "rename this spec, remove all the opinion about flathub - but keep the links to AI slop failed PRs and its policy" and "if needed, a new GHA to produce the .deb file".

## Context

Spec 064 specified two Linux stores, Flathub and the Snap Store, and required both to be published. Only the Snap Store channel was delivered. This specification closes the Flathub question and replaces it with a Debian package (`.deb`) published with each GitHub release. The `.deb` serves Debian-family distributions: Ubuntu, Linux Mint, Debian, and Pop!_OS. The AppImage and Snap Store channels are unchanged.

## Decision

- The project will not publish to Flathub.
- The non-Ubuntu Linux route is the `.deb`, published on the GitHub releases page beside the AppImage.
- The README documents installation from the `.deb`.

## Why Flathub is not used (recorded, factual)

Flathub's Generative AI policy (https://docs.flathub.org/docs/for-app-authors/requirements#generative-ai-policy) requires the manifest and the submission pull request to be human-authored, and leaves disclosed AI-generated application material to reviewer discretion, where reviewers "may reject a submission, including without further review". This project is developed with AI agents, so its application material would have to be disclosed into that discretionary review.

That discretion has been exercised at scale: on 2026-10-17 the flathub/flathub repository held 1,220 closed submissions with the "AI Slop" label ("Mark obviously AI generated PR or app"). Two examples: PR #10676 (turbo-clicker) is human-run, builds from a source tag, discloses only an AI-generated icon, and proceeds through normal review; PR #10674 (LeatherClient) carried an agent-prepared manifest and was closed and labelled "AI Slop". The policy was relaxed from a near-blanket ban to a disclosure rule on 2026-09-04 and the manifest rule was restored on 2026-09-21 (research D4).

The decision is a risk assessment: Flathub is not closed to this project by policy, but a disclosed AI-driven codebase enters a discretionary process whose observed default is rejection. The project therefore declines it. (This section records facts and links only; editorial commentary about Flathub is not included.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Debian-family user installs the `.deb` (Priority: P1)

A user on Linux Mint, Ubuntu, Debian, or Pop!_OS downloads `markdownmeister_<version>_amd64.deb` from the project's releases page and installs it, either by opening the file in their software installer or from a terminal. The app appears in the application menu and runs.

**Why this priority**: This is the whole point of the feature. Mint blocks snap, so this is the native install path for the target audience.

**Independent Test**: On Linux Mint and on Ubuntu, install the `.deb` from the releases page both ways (double-click and `apt`), launch from the menu, and open a folder.

**Acceptance Scenarios**:

1. **Given** the releases page, **When** the user opens the `.deb` in their software installer (for example Mint's package installer or GNOME Software), **Then** it offers to install and, after confirming, the app is installed with a menu entry.
2. **Given** the `.deb` in a terminal, **When** the user runs `sudo apt install ./markdownmeister_<version>_amd64.deb`, **Then** apt resolves dependencies and installs the app.
3. **Given** the installed app, **When** the user launches it from the application menu, **Then** it opens and can open a folder and edit markdown files.
4. **Given** the installed app, **When** the user runs `sudo apt remove markdownmeister`, **Then** the package is removed and leaves no files behind.

---

### User Story 2 - Every release carries a correct `.deb` (Priority: P1)

Each tagged release publishes a `.deb` whose version matches the release tag and which reports that version in the app.

**Why this priority**: A `.deb` that lags the release or reports the wrong version is misleading and would be noticed immediately.

**Independent Test**: Cut a release, confirm the `.deb` is present on it and named for the version, install it, and check the version the app reports.

**Acceptance Scenarios**:

1. **Given** a release, **When** it is published, **Then** the release contains `markdownmeister_<version>_amd64.deb`.
2. **Given** the installed `.deb`, **When** the app starts, **Then** it reports the release version.
3. **Given** the release, **When** the `.deb` is missing or misnamed, **Then** the release process fails rather than publishing an incomplete set.

---

### User Story 3 - The Flathub decision is recorded (Priority: P3)

A future maintainer can see that Flathub was considered, why it was declined, and what replaced it, so the question is not reopened from scratch.

**Why this priority**: The decision is a deliberate scope choice; the record and its links are the value.

**Independent Test**: Read this specification and confirm the Flathub reason, its links, and the replacement (`.deb`) are stated.

**Acceptance Scenarios**:

1. **Given** the archived specification, **When** read, **Then** the Flathub policy link, the "AI Slop" evidence, and the `.deb` replacement are all present.

---

### Edge Cases

- A non-Debian distribution (Fedora, openSUSE, Arch) is used: the `.deb` does not apply; the AppImage is the route, and Flatpak remains the only all-distribution option.
- The user runs `sudo dpkg -i` instead of `apt`: dependencies are not resolved automatically; the README recommends `apt install ./<file>.deb`.
- The architecture is arm64: out of scope; only amd64 is built, and the README says so.
- The `homepage` or maintainer value is missing: the `.deb` build fails, so both must be present in configuration (the package currently lacks them).
- A future decision to add automatic updates: an apt repository (PPA or managed) is a new feature, not part of this one.
- Someone else lists the app on Flathub: the project neither maintains nor supports it; this decision governs the project's own actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The release MUST publish a `.deb` package for x86-64, built from the same tagged release as every other channel.
- **FR-002**: The `.deb` filename MUST include the package name, the release version, and the architecture.
- **FR-003**: The `.deb` MUST install on Debian-family distributions (Ubuntu, Linux Mint, Debian, Pop!_OS), register an application-menu entry, and launch the app.
- **FR-004**: The `.deb` MUST be installable both by opening it in a graphical software installer and by `sudo apt install ./<file>.deb`.
- **FR-005**: The `.deb` MUST declare its dependencies and metadata (maintainer, homepage, description, category) so apt can install it cleanly.
- **FR-006**: The installed app MUST report the same version as the release tag.
- **FR-007**: The README MUST document installing and uninstalling the `.deb`, including the two install methods, the amd64-only note, and the distributions it covers.
- **FR-008**: The release process MUST verify the `.deb` exists and is named for the version, and fail otherwise.
- **FR-009**: The project MUST NOT produce or submit a Flathub manifest or Flatpak packaging.
- **FR-010**: Spec 064's requirement to publish to Flathub (its FR-001) is withdrawn by this specification.
- **FR-011**: The AppImage and Snap Store channels and their build configuration MUST be unchanged.
- **FR-012**: No credentials and no repository infrastructure are introduced; the `.deb` is a release asset, not a hosted repository.

### Key Entities *(include if feature involves data)*

- **Debian package (`.deb`)**: An `ar` archive containing `debian-binary`, a `control` tarball (metadata and install scripts), and a `data` tarball (the installed files). Not a zip; see research D1.
- **Release asset**: The `.deb` attached to a GitHub release, downloaded and installed by the user.
- **Debian-family distribution**: Ubuntu, Linux Mint, Debian, Pop!_OS, and derivatives, the audience for this package.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Mint or Ubuntu user can install the app from the releases page in under two minutes, by one double-click or one command.
- **SC-002**: In 100% of releases, the `.deb` is present, named for the version, and reports that version when installed.
- **SC-003**: In 100% of uninstall tests, `apt remove` leaves no application files behind.
- **SC-004**: No Flathub manifest exists in the repository or is submitted.
- **SC-005**: The AppImage and snap build outputs are unaffected by this change.

## Assumptions

- **Scope**: This feature adds a release artifact and its documentation. It changes no application behaviour.
- **Debian-family only**: The `.deb` reaches Ubuntu, Mint, Debian, and Pop!_OS, not Fedora, openSUSE, or Arch. Those rely on the AppImage today.
- **No automatic updates**: The `.deb` is a release asset; updates are a manual re-download. An apt repository (PPA or managed) is a deliberate future option, not part of this feature.
- **No signing required**: A locally installed `.deb` needs no repository signature. Signing matters only if a repository is added later.
- **Packaging metadata is currently missing**: `package.json` has no `author` or `homepage`, which the Debian builder requires; both must be supplied (research D2).
- **Verification is partly manual**: Building and installing the `.deb` can be automated on CI; a real graphical-installer install and menu launch on Mint and Ubuntu remain manual, documented checks.

## Clarifications

### 2026-10-17 (decision recorded during specification)

- **Flathub declined, `.deb` chosen**: On reviewing Flathub's requirements and Generative AI policy and the volume of "AI Slop" closures, the maintainer decided not to pursue Flathub and to distribute a `.deb` from the releases page instead. Spec 064's Flathub requirement is withdrawn.
- **Editorial removed, links kept**: The earlier draft's commentary about Flathub is removed. The policy link and the "AI Slop" evidence (the label and the two example pull requests) are kept as the factual basis.
- **AI applications are not excluded (correction)**: Flathub hosts AI applications, including the AI coding agent OpenCode (`ai.opencode.opencode`), LM Studio, Jan, and GPT4All. The policy targets AI-generated submission content and obviously AI-generated apps, not AI applications. Any earlier claim that AI tooling is excluded is withdrawn.
- **No new workflow needed**: The `.deb` is an added Linux target in the existing release workflow, not a new GitHub Actions workflow (research D3).
