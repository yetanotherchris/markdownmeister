# Feature Specification: Windows Store Distribution

**Feature Branch**: `062-windows-store-distribution`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "I want the app to be available through the Windows store"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and install from the Microsoft Store (Priority: P1)

A Windows user searches the Microsoft Store for a markdown editor, finds MarkdownMeister under its product name, reads its listing, and installs it with one click. The install carries trusted identity from Microsoft's own signing, so there is no developer-certificate warning and no SmartScreen reputation problem.

**Why this priority**: Availability in the Store is the entire request; without a discoverable, installable listing the feature has not happened.

**Independent Test**: Search the Store for the product name on an up-to-date Windows 11 machine, install from the listing, and launch the app.

**Acceptance Scenarios**:

1. **Given** an up-to-date Windows machine, **When** the user searches the Store for the product name, **Then** MarkdownMeister is found and its listing opens.
2. **Given** the listing is open, **When** the user installs, **Then** the app installs without any developer-certificate or SmartScreen warning.
3. **Given** the app is installed from the Store, **When** the user launches it, **Then** it opens normally with the same features as the other distribution channels.
4. **Given** a signed-out or offline Store, **When** the user attempts to install, **Then** the Store reports its own clear, actionable state and nothing partial is installed.

---

### User Story 2 - The Store install behaves like every other channel (Priority: P1)

The Store build is not a reduced app. Opening a folder from File Explorer, the Windows 11 first-level folder action delivered in spec 038, single-instance routing, unsaved-changes confirmation, and path containment all behave exactly as they do for the installer and Scoop builds.

**Why this priority**: A Store build that bypassed or diverged from the existing safeguards would create two different applications with one name, and would undermine the security boundary in Principle II.

**Independent Test**: Install only the Store build and exercise folder opening (both entry points), a running-instance second open, a dirty-tabs workspace switch, and adversarial folder paths; compare every outcome with the installer build.

**Acceptance Scenarios**:

1. **Given** the Store build installed on Windows 11, **When** the user right-clicks a folder, **Then** the first-level "Open in MarkdownMeister" entry appears and opens that folder as the workspace.
2. **Given** the Store build, **When** a folder path is handed over from the shell, **Then** it is treated as untrusted and validated exactly as every other external path, failing closed without exposing unrelated locations.
3. **Given** the Store build and a running instance, **When** the user opens a second folder, **Then** the existing single-instance routing and any unsaved-changes confirmation apply unchanged.
4. **Given** the Store build, **When** the user opens a `.md` or `.markdown` file through the shell, **Then** it follows the same open behaviour as the other channels.

---

### User Story 3 - Updates arrive through the Store (Priority: P2)

When a new version is submitted, the Store delivers the update. The installed app, including its folder entry, keeps working and reports the new version after updating.

**Why this priority**: A channel that cannot be updated safely strands users on an old version, which is the failure mode Store distribution is supposed to avoid.

**Independent Test**: Submit a newer version, update through the Store, and confirm the app launches the new version with folder integration intact.

**Acceptance Scenarios**:

1. **Given** an installed Store version, **When** an update is available, **Then** the Store offers and applies it without a manual reinstall.
2. **Given** an update completed, **When** the user launches the app, **Then** the version shown matches the submitted version and the folder entry still works.
3. **Given** an update is submitted but rejected in certification, **When** the process ends, **Then** the previously installed version and its integration remain intact.

---

### User Story 4 - Store and non-Store channels coexist without interference (Priority: P2)

A user may have the Store build alongside an installer or Scoop install. Each continues to work, each owns its own registrations, and removing one leaves the other untouched.

**Why this priority**: Spec 038 made channel isolation a rule for the shell extension; Store availability must not regress it for existing users.

**Independent Test**: Install the Store build alongside another channel, verify both open folders correctly, then remove one and verify the other still works and no dead entries remain.

**Acceptance Scenarios**:

1. **Given** the Store build and another channel installed together, **When** either opens a folder, **Then** both work independently.
2. **Given** the Store build is uninstalled, **When** the shell's folder menu is inspected, **Then** no Store-owned entry remains and the other channel's entry still works.
3. **Given** the Store build is installed, **When** the registrations of the other channels are inspected, **Then** they are unchanged.

---

### User Story 5 - The listing accurately represents the app (Priority: P2)

The Store listing presents the correct product name, a short and accurate description, the product icon and screenshots, the category, the licence, and working support and privacy links, so a user can judge the app before installing.

**Why this priority**: An incomplete or inaccurate listing fails certification and misleads users even when the package itself is correct.

**Independent Test**: Walk the listing against a completeness checklist (name, description, screenshots, category, age rating, support, privacy) and confirm every field and link is present and correct.

**Acceptance Scenarios**:

1. **Given** the listing, **When** a user reads it, **Then** the product name matches the app and the description matches what the app does.
2. **Given** the listing, **When** the user follows the support and privacy links, **Then** they resolve to reachable, relevant pages.
3. **Given** the Store's required listing assets, **When** the maintainer assembles the submission, **Then** every required field and image is present before submission.
4. **Given** the app requires the full-trust desktop capability, **When** the submission is prepared, **Then** that capability and its certification justification are declared.

---

### Edge Cases

- The product name is already taken in Partner Center: the reserved identity must be settled before packaging, and the package identity must match it exactly.
- Placeholder identity values are still in the packaging configuration: submission must fail rather than publish a package with placeholder identity.
- Certification rejects the submission: the previously published version must remain live and unaffected, and the rejection feedback must be actionable.
- A market or device family does not support the package: the Store must present a clear unsupported result rather than installing an incompatible build.
- The Store package and an installer build are both present: both are usable and neither breaks the other.
- The Store build is uninstalled while Explorer is running: the folder entry disappears without leaving dead entries, including after an Explorer restart.
- A Store update is interrupted: the previously working version must remain usable.
- The Store is unavailable (offline or regional): the app remains installable and reachable through the other documented channels.
- The Store build's shell extension faults (missing or corrupted component): it must not crash or hang Explorer, matching spec 038 FR-011.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be available for discovery and installation in the Microsoft Store under the product display name MarkdownMeister.
- **FR-002**: The Store package MUST carry trusted package identity obtained from the Store's own signing, with no developer-purchased certificate required for the Windows Store channel.
- **FR-003**: The Store package identity (identity name and publisher) MUST use the real values assigned to the product in Partner Center; placeholder values MUST NOT reach a submission.
- **FR-004**: The Store listing MUST include the product name, a description, the category, required images and screenshots, an age rating, and reachable support and privacy links.
- **FR-005**: The Store package MUST include the native shell-extension component and provide the Windows 11 first-level folder action defined by spec 038, with its fault-containment guarantees intact.
- **FR-006**: Invoking a folder or file from the shell into the Store build MUST route through the same validated open path as every other channel, preserving Principle II (untrusted paths, main-process validation, fail closed).
- **FR-007**: Updates delivered through the Store MUST keep the app working, keep the folder integration present, and result in the expected version being installed.
- **FR-008**: Uninstalling the Store build MUST remove every Store-owned registration, leaving no dead entries, and MUST NOT affect other applications or other MarkdownMeister channels.
- **FR-009**: Store and non-Store channels MUST coexist; each MUST own exactly its own registrations, and removing one MUST NOT disturb the other.
- **FR-010**: The Store package version MUST correspond to the released version it is built from, so the Store listing and the app's reported version agree.
- **FR-011**: The Store package MUST declare the restricted capability required for a full-trust desktop application, with the certification explanation, and MUST NOT declare capabilities it does not use.
- **FR-012**: The project README and/or project page MUST state that the app is available in the Microsoft Store and link to the listing.
- **FR-013**: The maintainer-facing submission and update procedure MUST be documented, including where identity values come from and what must be verified before submitting.
- **FR-014**: Building the Store package MUST remain separate from the direct-download release artifacts, so neither channel ships the other's output by mistake.
- **FR-015**: A failed or rejected Store submission MUST NOT alter the published direct-download release or the package definitions for Homebrew and Scoop.

### Key Entities *(include if feature involves data)*

- **Store package**: The Store-distributed build carrying Microsoft-provided identity; the only artifact through which the Store channel reaches users.
- **Store listing**: The public product page (name, description, images, category, links) users see before installing.
- **Package identity**: The identity name and publisher assigned in Partner Center that every submitted package must match exactly.
- **Channel isolation**: The rule that each distribution channel owns exactly its own registrations and cleanup.
- **Hand-off payload**: A folder or file path supplied by the shell, untrusted until validated in the application's main process.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Windows user can find and install the app from the Microsoft Store in under two minutes without encountering a certificate or SmartScreen warning.
- **SC-002**: In 100% of Store-install tests on up-to-date Windows 11, the folder action behaves identically to the installer build, including adversarial-path handling.
- **SC-003**: In 100% of uninstall tests, no Store-owned entry remains after removal (verified after an Explorer restart) and other channels and applications are unaffected.
- **SC-004**: In 100% of coexistence tests, the Store build and one other channel both work and neither breaks the other.
- **SC-005**: In 100% of submitted packages, identity values match Partner Center; zero placeholder values reach the Store.
- **SC-006**: The listing completeness checklist passes before every submission (name, description, images, category, age rating, support, privacy).
- **SC-007**: A published update reaches an installed app through the Store and launches the expected version.

## Assumptions

- **Packaging already exists**: The Store package build and its CI workflow were delivered by spec 038; this feature does not re-package the app, it makes the app available through the Store. Spec 038's deferred classic-mechanism fallback for Windows versions without the modern menu (its FR-013) remains out of scope here.
- **Free developer account**: Store registration for individual developers is free; the maintainer will use an individual account unless a company account is separately chosen. No developer-purchased certificate is needed because the Store re-signs the package.
- **Certification lag**: Store review adds days-to-weeks versus a GitHub release, and this is accepted as the cost of the channel. The submission may be rejected; the direct-download release is unaffected.
- **Listing ownership**: Screenshots, the description, and the support/privacy URLs are maintainer-provided; the privacy policy is required by the Store even though the app collects no personal data.
- **Channel isolation continues**: Existing registrations from specs 006/035/038 remain the source of truth for the non-Store channels and are not modified by this feature.
- **Verification is largely manual**: Real Store discovery, certification, install, update, and uninstall cannot be exercised by the automated test suite; verification is performed against the real listing and installed artifacts, supplemented by the automated channel-isolation tests that already exist.

## Clarifications

### 2026-09-26 (during specification)

- **Scope after the existing packaging**: Spec 038 already built the Store package (MSIX) and its workflow as the delivery vehicle for the Windows 11 first-level folder menu. The user chose to have this spec finish the publication path: Partner Center identity, listing, submission, updates, and documentation, rather than re-specifying packaging.
- **Not yet published**: The Store listing does not exist today; the configuration still carries placeholder identity values, so publication is genuinely outstanding work, not a documentation gap.
- **Account**: A free individual developer account is the working assumption; if a company identity is preferred it can be substituted without changing this spec's requirements.
