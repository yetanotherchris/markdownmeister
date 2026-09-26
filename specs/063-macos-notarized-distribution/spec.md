# Feature Specification: macOS Signed and Notarized Distribution

**Feature Branch**: `063-macos-notarized-distribution`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "I want the app to be available through the equivalent Mac (apple store? I have a developer $99 account)". After advice, the chosen path is Developer ID signing and notarization of the existing direct-download artifacts; the Mac App Store is deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download and open without a security warning (Priority: P1)

A macOS user downloads the app from the releases page, double-clicks it, and it opens. They are not told that Apple cannot verify the app, do not have to right-click and choose Open, and do not have to visit Privacy & Security to allow it.

**Why this priority**: Removing the "unverified developer" block is the whole point of notarization; an unsigned download is effectively unusable for ordinary users.

**Independent Test**: On a stock macOS machine with default Gatekeeper settings, download the published DMG and the published ZIP, launch the app from each by double-click, and confirm it opens with no warning and no extra steps.

**Acceptance Scenarios**:

1. **Given** the published macOS DMG, **When** the user opens it on a stock macOS machine, **Then** the app launches without the unidentified-developer or malware-verification warning.
2. **Given** the published macOS ZIP, **When** the user extracts and opens the app, **Then** it launches without the warning.
3. **Given** either artifact is downloaded through a browser (quarantined), **When** the user opens it, **Then** Gatekeeper accepts it and the app launches normally.
4. **Given** the app is installed via Homebrew, **When** the user launches it, **Then** it opens with the same warning-free behaviour.
5. **Given** both supported architectures, **When** each published artifact is opened on its matching machine, **Then** both launch without a warning.

---

### User Story 2 - Signing and notarization integrity (Priority: P1)

The maintainer can trust that every published macOS artifact was signed with the project's Developer ID certificate, passed notarization, and has the notarization ticket attached, so the release can never ship a build that breaks Gatekeeper.

**Why this priority**: A partially signed or unstapled artifact silently reintroduces the warning; the integrity guarantee is what makes the feature reliable rather than a one-off manual fix.

**Independent Test**: Inspect a published artifact's signature and stapled ticket and confirm they match the Developer ID identity, then open it offline to prove the ticket is attached.

**Acceptance Scenarios**:

1. **Given** a published artifact, **When** its signature is inspected, **Then** it is signed with the expected Developer ID identity and the hardened runtime is enabled.
2. **Given** a published artifact, **When** it is opened with no network connection, **Then** the notarization ticket is present locally and the app still launches without a warning.
3. **Given** the app bundles helper processes, **When** the bundle is verified, **Then** every nested executable is signed correctly and the bundle validates as a whole.
4. **Given** a version is built from a release tag, **When** it is published, **Then** the signed version matches the release version.
5. **Given** the app bundle that is archived, **When** it is stapled and then wrapped into the DMG and ZIP, **Then** the app extracted from each final published archive still passes Gatekeeper offline, proving the ticket travelled with the published bytes rather than only existing in the build directory.
6. **Given** both published architectures, **When** each DMG and ZIP is verified, **Then** all four artifacts carry valid signatures and stapled tickets.

---

### User Story 3 - A failed signing or notarization stops the release (Priority: P2)

If signing fails, or Apple's notarization service rejects the build, the release does not publish an unsigned or unnotarized macOS artifact. Users only ever see artifacts that passed.

**Why this priority**: Shipping the artifact anyway would undo the feature and, worse, would look like success while users hit the warning again.

**Independent Test**: Force signing or notarization to fail in a test pipeline and confirm the whole release is withheld for that version, with the failure clearly reported.

**Acceptance Scenarios**:

1. **Given** signing fails, **When** the release pipeline runs, **Then** no public release is created and the failure is reported to the maintainer.
2. **Given** notarization is rejected, **When** the pipeline runs, **Then** the release does not publish that version and the rejection reason is surfaced.
3. **Given** a failure, **When** the release ends, **Then** no public release exists for the tag and the package definitions are not updated, so users remain on the prior complete version (spec 005).
4. **Given** the macOS artifacts fail, **When** the release ends, **Then** the Homebrew definition is not updated to point at a missing or invalid artifact, and neither is the Scoop definition.

---

### User Story 4 - Existing macOS behaviour is unchanged (Priority: P2)

Signing and notarization are added to the existing direct distribution without changing how the app works: opening folders by Dock drop, by `open -a`, by Open With, and by document association all continue to work, and the app is not sandboxed.

**Why this priority**: The feature should make the same app easier to install, not quietly restrict it; sandboxing is explicitly not part of this path.

**Independent Test**: With the signed/notarized build, exercise folder opening (Dock drop, command line, Open With) and file association, and confirm identical behaviour to the previous build.

**Acceptance Scenarios**:

1. **Given** the notarized build, **When** a folder is dropped on the Dock icon or opened via `open -a`, **Then** it opens as the workspace exactly as before.
2. **Given** the notarized build, **When** a `.md`/`.markdown` file is opened through the shell, **Then** it follows the existing behaviour.
3. **Given** the notarized build, **When** the user browses and edits files in an opened folder, **Then** filesystem access and path containment are unchanged, with no new sandbox restrictions.
4. **Given** the notarized build, **When** updates are considered, **Then** no auto-update mechanism is introduced or removed by this feature.

---

### Edge Cases

- Apple's notarization service is unavailable or slow: the release waits or fails clearly; it does not publish an unnotarized artifact.
- The Developer ID certificate expires or is revoked: the pipeline fails clearly rather than publishing an unverifiable build.
- A helper process inside the bundle is missed during signing: bundle verification must fail the release, not ship a partially signed app.
- The artifact is downloaded with a quarantine attribute: a stapled ticket must be enough to open it without an internet connection.
- Only the intermediate app is stapled but the published archive is not: verification of the final DMG and of the app extracted from the final ZIP must catch this and block the release.
- An Intel machine runs the arm64 artifact (or vice versa): the artifacts remain architecture-correct; the wrong architecture must not be offered.
- A user on an older macOS version: the signed build must still open within the versions the app supports.
- The Apple account is unavailable to the pipeline: releases block rather than silently falling back to an unsigned build.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every published macOS artifact MUST be signed with the project's Developer ID Application identity.
- **FR-002**: Every published macOS artifact MUST be notarized by Apple. The app bundle MUST be stapled before it is archived, so the app inside the published DMG and the app extracted from the published ZIP can be validated without a network connection; the stapled app MUST be verified inside the final distributed DMG and inside the app extracted from the final ZIP.
- **FR-003**: Opening the published app on a stock macOS machine MUST NOT show the unidentified-developer or malware-verification warning and MUST NOT require right-click-Open or a Privacy & Security exception.
- **FR-004**: The hardened runtime MUST be enabled, with the entitlements the application legitimately requires, and no broader entitlements than necessary.
- **FR-005**: All nested executables and frameworks inside the bundle MUST be signed so the bundle verifies as a whole, and the final published DMG and ZIP for each architecture (x64 and arm64) MUST each be verified after packaging, including a Gatekeeper assessment of the downloaded, quarantined artifact.
- **FR-006**: Signing and notarization credentials MUST be supplied to the release pipeline as protected secrets and MUST NOT be committed to the repository.
- **FR-007**: If signing, bundle verification, or notarization fails, the whole tagged release MUST NOT be published and the package definitions (Homebrew, Scoop) MUST NOT be updated with artifacts from that release, preserving spec 005's release-completeness rule. The failure MUST be surfaced to the maintainer. If the maintainer chooses to allow a partial release instead, spec 005 must be amended first to define that behaviour.
- **FR-008**: The signed, notarized artifacts MUST keep the existing names and locations so the Homebrew formula and release links continue to work.
- **FR-009**: Both supported architectures MUST be signed and notarized and MUST carry the correct version.
- **FR-010**: The feature MUST NOT sandbox the app and MUST NOT change folder access, document association, or the absence of an auto-update mechanism.
- **FR-011**: The README MUST document the warning-free macOS download and MUST NOT instruct users to bypass Gatekeeper.
- **FR-012**: A failed macOS release MUST NOT cause the Homebrew definition or other package definitions to reference an artifact that was not published.
- **FR-013**: Verification of the final downloaded artifact MUST run in CI on a macOS runner for both architectures, applying the quarantine attribute and a Gatekeeper assessment; a physical Mac is required only for behaviour CI cannot exercise and MUST NOT be the only evidence for the launch criterion.

### Key Entities *(include if feature involves data)*

- **Developer ID Application identity**: The signing identity from the Apple Developer Program used for direct distribution outside the App Store.
- **Notarization ticket**: Apple's record that the artifact passed the automated security scan, attached to the bundle so it can be verified offline.
- **Hardened runtime**: The runtime restriction enabled for distribution, with the minimum entitlements the app needs.
- **Release artifact**: The versioned macOS archive (DMG and ZIP, per architecture) published on the releases page and consumed by Homebrew.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of release verification runs, the published DMG and the app extracted from the published ZIP both pass Gatekeeper assessment on both architectures with no user intervention.
- **SC-002**: A first-time macOS user can download and open the app without visiting system security settings or using right-click-Open.
- **SC-003**: Zero unsigned or unnotarized macOS artifacts are published; a signing/notarization failure blocks the whole release.
- **SC-004**: In 100% of regression checks, folder opening, file association, and filesystem path handling are unchanged from before this feature.
- **SC-005**: The Homebrew install path continues to install and launch the notarized artifact.
- **SC-006**: Rotating the signing credentials is a secret change only and does not require a code change to the pipeline.

## Assumptions

- **Apple Developer Program**: The maintainer holds an active paid Apple Developer Program membership ($99/year), which is required for a Developer ID certificate and notarization.
- **No Mac ownership required**: Signing and notarization can run on CI macOS runners using credentials and an App Store Connect API key created in Apple's web portal. The maintainer does not currently own a Mac.
- **Mac App Store is deferred**: The Mac App Store was requested but is out of scope for this feature because it mandates app sandboxing, which conflicts with the app's folder-first behaviour and cannot be developed and tested without Mac access. It is recorded as a separate, deferred concern.
- **No sandbox, no new updater**: Direct distribution does not require sandboxing, and the app does not currently use an in-app auto-updater; neither is introduced here.
- **Artifacts unchanged**: The release still produces the same DMG and ZIP for x64 and arm64, consumed by Homebrew and the releases page.
- **Verification split**: Automated checks on a macOS CI runner cover signature presence, bundle integrity, stapling, and a Gatekeeper assessment of each final quarantined artifact; they also cover pipeline failure behaviour. A physical Mac is used only for behaviour CI cannot exercise and is not the sole evidence for the warning-free launch criterion.
- **Release-completeness contract**: Spec 005 requires that a failed required-platform build publishes neither a public release nor package-definition updates. This feature preserves that contract rather than narrowing it to macOS alone.

## Clarifications

### 2026-09-26 (during specification)

- **Route decision**: The user asked for the "Mac equivalent (Apple store?)". After receiving advice that the Mac App Store mandates sandboxing and cannot be tested without Mac access, the user chose Developer ID signing plus notarization of the existing direct downloads instead.
- **Notarization explained**: The maintainer was told what notarization is (automated Apple security scan for apps distributed outside the App Store, producing a stapled ticket that lets Gatekeeper open the app without a warning) before choosing it.
- **Mac App Store deferred, not rejected**: The App Store remains a possible future channel; this spec intentionally excludes it rather than compromising it into the same change.

### 2026-09-26 (revision after independent review)

- **Release-completeness preserved**: FR-007 now follows spec 005 (no partial release on a required-platform failure) instead of allowing a release with the macOS artifact missing; amending spec 005 is an explicit prerequisite for any partial-release behaviour.
- **Final artifacts verified, not the intermediate app**: FR-002/FR-005 and the new scenarios require stapling the app before archiving and verifying the app inside the final DMG and the final ZIP, for both architectures, because a ZIP cannot itself be stapled.
- **CI-based Gatekeeper evidence**: FR-013 makes a quarantined Gatekeeper assessment of the final downloaded artifact on a macOS CI runner mandatory, rather than relying on a borrowed Mac as the only evidence.
