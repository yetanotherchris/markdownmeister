# Feature Specification: Mac App Store Setup Guide

**Feature Branch**: `spec-070-macos-app-store-submission`

**Created**: 2026-10-17

**Status**: Archived

**Input**: User description: "I think I need to create the app on the appstore first." The project needs a maintainer guide for creating the App Store Connect app record and safely preparing the required Apple and GitHub configuration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare an App Store Connect app record (Priority: P1)

A maintainer can create the MarkdownMeister App Store Connect app record before future delivery automation is enabled.

**Why this priority**: An App Store package cannot be associated with a product until its record exists.

**Independent Test**: A maintainer follows the guide and creates an App Store Connect app record using the documented bundle identifier.

**Acceptance Scenarios**:

1. **Given** no App Store Connect record exists, **When** the maintainer reads the guide, **Then** they find the required app-record setup steps and bundle identifier.
2. **Given** the maintainer is preparing Apple credentials, **When** they follow the guide, **Then** they are directed to retain credential files outside the repository.

---

### User Story 2 - Prepare protected release credentials (Priority: P1)

A maintainer can configure a protected GitHub environment with the credential names needed by future Store package automation without placing secrets in source control.

**Why this priority**: Store signing material is sensitive and must be protected before any automation can use it.

**Independent Test**: A maintainer can create the documented protected environment and add each named secret without consulting repository source code.

**Acceptance Scenarios**:

1. **Given** the guide is followed, **When** the protected environment is configured, **Then** it requires approval before exposing credentials.
2. **Given** the required certificate, provisioning profile, and API key exist, **When** the maintainer follows the guide, **Then** each is assigned to a named environment secret rather than committed.

## Edge Cases

- The App Store Connect record uses a different bundle identifier: the guide explains that it is a different product and must not be used for MarkdownMeister.
- A credential is accidentally added to the repository: the guide directs the maintainer to keep credential files outside version control.
- An uploaded build is processed: the guide makes clear that App Review and public release remain manual decisions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide `docs/apple-appstore-howto.md` for Mac App Store setup.
- **FR-002**: The guide MUST document creating the MarkdownMeister App Store Connect app record before delivery automation exists.
- **FR-003**: The guide MUST identify the required bundle identifier and initial product-record fields.
- **FR-004**: The guide MUST document preparing Apple Distribution signing material, a provisioning profile, and an App Store Connect API key without including credentials.
- **FR-005**: The guide MUST name the protected GitHub deployment environment and every required credential secret.
- **FR-006**: The guide MUST state that App Review and public release remain manual App Store Connect actions.
- **FR-007**: The guide MUST explain that direct-download artifacts are a separate distribution channel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer can create the App Store Connect app record by following `docs/apple-appstore-howto.md` without consulting repository source code.
- **SC-002**: A maintainer can configure the protected GitHub environment and its named secrets without committing credentials.
- **SC-003**: The guide clearly distinguishes future package delivery from App Review and public release.

## Assumptions

- The maintainer has an active Apple Developer Program membership.
- A future specification will define the Store package generation and App Store Connect submission workflow after the app record exists.

## Clarifications

### 2026-10-17

- This specification intentionally covers only the completed setup guide. Store package generation and automated submission are deferred to a separate follow-on specification.
