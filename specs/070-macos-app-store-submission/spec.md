# Feature Specification: Mac App Store Submission

**Feature Branch**: `spec-070-macos-app-store-submission`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "I think I need to create the app on the appstore first. So if it's possible to automate this, then please create a new speckit spec for this, with the dependency that an appstore app is created first (assuming it works like windows store)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create the App Store listing before delivery (Priority: P1)

A maintainer creates the MarkdownMeister app record in App Store Connect before any automated submission can begin, so each uploaded build has a valid product destination, bundle identity, and version history.

**Why this priority**: An upload cannot be processed without an existing App Store Connect app record. Making this an explicit prerequisite prevents a release workflow from failing after it has already built a package.

**Independent Test**: A maintainer follows the documented prerequisite steps and confirms that an App Store Connect app record exists for MarkdownMeister with the expected bundle identifier before enabling submission credentials.

**Acceptance Scenarios**:

1. **Given** no App Store Connect app record exists, **When** a maintainer prepares this feature, **Then** the documentation directs them to create the record before configuring automated submission.
2. **Given** an app record exists with a different bundle identifier, **When** release preparation is checked, **Then** submission is blocked with an actionable explanation rather than uploading to the wrong product.
3. **Given** the expected app record exists, **When** the maintainer configures protected credentials, **Then** the release workflow can target that record without storing credentials in the repository.

---

### User Story 2 - Submit a versioned build automatically (Priority: P1)

A maintainer tags a release from `main` and receives a matching Mac App Store build in App Store Connect without manually creating, downloading, or uploading package files.

**Why this priority**: Automated submission removes the error-prone manual transfer step while preserving the existing tag-based release process.

**Independent Test**: In a test App Store Connect app record, trigger a valid release tag and verify that one processing build appears with the tag's version and build number.

**Acceptance Scenarios**:

1. **Given** a valid version tag reachable from `main` and a prepared App Store Connect record, **When** the release workflow runs, **Then** it submits one Mac App Store package carrying that release version.
2. **Given** the submitted package is processed, **When** the maintainer opens App Store Connect, **Then** the build is associated with the MarkdownMeister app record and ready for the maintainer's review submission.
3. **Given** the version was already uploaded to App Store Connect, **When** the workflow runs again, **Then** it fails clearly without overwriting or duplicating the existing build.
4. **Given** the maintainer has not configured the required protected credentials, **When** the workflow runs, **Then** it stops before submission and reports the missing configuration without exposing secret values.

---

### User Story 3 - Preserve direct-download and Store channels (Priority: P2)

A maintainer can release the existing direct-download artifacts and a Mac App Store build from the same source version without either channel weakening the other.

**Why this priority**: The direct-download channel remains useful for users outside the Store, while Store users need Apple's managed installation and updates.

**Independent Test**: Verify that a release produces its existing direct-download assets and submits the corresponding Store build, while each channel keeps its established installation behavior.

**Acceptance Scenarios**:

1. **Given** a successful release, **When** the release completes, **Then** the existing direct-download artifacts retain their filenames and package-manager compatibility.
2. **Given** the Store package is prepared, **When** it is submitted, **Then** it uses the App Store-specific signing and sandbox permissions without changing the direct-download application's folder behavior.
3. **Given** Store submission fails, **When** the release finishes, **Then** the failure is visible to the maintainer and does not silently claim that the Store build was delivered.

## Edge Cases

- The App Store Connect app record has not been created: submission stops before package upload and directs the maintainer to the prerequisite guide.
- The Store's version or build number is already in use: submission stops and identifies the version conflict.
- Apple processing rejects the package: the maintainer can find the rejected build and its processing feedback in App Store Connect; no automatic review submission occurs.
- Submission credentials are missing, expired, revoked, or unauthorized: the workflow stops without exposing them.
- The Store's sandbox restrictions prevent an existing folder workflow: the Store package is blocked until the required least-privilege permission is documented and verified.
- A direct-download release succeeds but Store submission fails: the failure is reported separately and the release notes do not claim Store availability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST document creating the MarkdownMeister app record in App Store Connect as a prerequisite to automated submission.
- **FR-002**: The prerequisite guide MUST identify the required bundle identifier, product metadata, and App Store Connect record fields without including credentials.
- **FR-003**: The project MUST produce a Mac App Store package signed for App Store distribution and configured with the minimum sandbox permissions needed for user-selected folder editing.
- **FR-004**: A version tag reachable from `main` MUST trigger automated submission of the matching Store package to the prepared App Store Connect app record.
- **FR-005**: Automated submission credentials MUST be supplied only through a protected deployment environment and MUST NOT be committed to the repository.
- **FR-006**: The automated submission MUST stop clearly when the App Store prerequisite, package validation, credentials, version, or upload fails.
- **FR-007**: The workflow MUST NOT automatically submit the build for Apple review or release it to users. The maintainer retains those decisions in App Store Connect.
- **FR-008**: The existing direct-download artifacts and their package-manager definitions MUST remain supported and unchanged by Store packaging.
- **FR-009**: The project MUST provide a maintainer guide at `docs/apple-appstore-howto.md` that includes both the App Store Connect prerequisite and the protected GitHub Actions signing-key setup required for the Store package.
- **FR-010**: The guide MUST explain how a maintainer verifies an uploaded build, completes required App Store Connect metadata, and submits it for Apple's review.

### Key Entities

- **App Store Connect app record**: The product record created by the maintainer before build delivery, identified by MarkdownMeister's bundle identifier.
- **Store package**: The versioned, sandboxed package uploaded for App Store Connect processing.
- **Submission credential**: Protected authentication material permitting the release workflow to deliver a package to the specific App Store Connect app record.
- **Processing build**: The uploaded Store package after App Store Connect accepts it for processing; it is not yet an approved or public release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer can create the required App Store Connect app record by following `docs/apple-appstore-howto.md` without consulting repository source code.
- **SC-002**: In 100% of valid tagged release tests using a prepared test app record, one matching processing build appears in App Store Connect.
- **SC-003**: In 100% of missing-prerequisite, credential, package, or duplicate-version failures, no Store build is submitted and the workflow reports the blocking cause.
- **SC-004**: Direct-download artifacts remain available and installable after Store submission support is added.
- **SC-005**: No workflow automatically sends a build to Apple review or makes it publicly available.

## Assumptions

- The maintainer has an active Apple Developer Program membership and can create the App Store Connect app record.
- The maintainer will create the App Store Connect record before configuring the protected submission environment.
- A dedicated protected deployment environment gates submission credentials and requires maintainer approval.
- App review, pricing, availability, screenshots, age ratings, privacy disclosures, and final release remain human App Store Connect tasks.
- The direct-download release channel remains separate from the Store channel.

## Clarifications

### 2026-10-17

- This feature starts only after the maintainer creates the App Store Connect app record. It automates package delivery, not Apple review submission or public release.
- The prior notarized direct-download work is a separate distribution channel. It does not make an application eligible for the Mac App Store.
