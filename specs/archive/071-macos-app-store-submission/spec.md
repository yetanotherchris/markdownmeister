# Feature Specification: Mac App Store Build Upload

**Feature Branch**: `spec-071-macos-app-store-submission`

**Created**: 2026-10-25

**Status**: Archived

Delivery automation is implemented. Signed macOS packaging, live upload, and Store-channel runtime verification remain outstanding as recorded in the plan and tasks; archiving the implementation artifacts does not establish public Store readiness.

**Input**: "can you create this for me, using a new branch? I will create the dev cert now", corrected to "installer cert*". The maintainer wants automated Store package creation and upload using existing signing and upload credentials.

## User Scenarios & Testing

### User Story 1: Build and upload a Store package (P1)

The maintainer starts a delivery run, which builds a package supporting Intel and Apple silicon, verifies its signatures and identity, and uploads it for processing. Selecting a build for review and releasing it remain manual decisions.

Acceptance scenarios:

1. Given valid Store credentials, when delivery is manually dispatched from a release tag, a signed universal Store package with that tag's version is retained as a build artifact and uploaded for processing.
2. Given build-only mode, when delivery runs, the signed package is retained without contacting the upload service.
3. Given missing credentials, an expired or mismatched provisioning profile, invalid signatures, or rejected upload validation, delivery fails and reports the failed operation.
4. Given a repeat upload for the same product version, the maintainer can select a higher build number without changing the product version.
5. Given a branch, a non-release tag, or a tag with an invalid version, delivery fails before entering the credential-bearing job.
6. Given the selected tag's source metadata still has the previous product version, delivery packages and verifies the version from the tag.
7. Given the delivery form on the primary branch, when the maintainer enters a release version without the `v` prefix, a credential-free launcher starts a tagged build with the same upload choice and requested build number.
8. Given the requested version and the tagged run's version differ, delivery fails before the credential-bearing job.

### User Story 2: Configure delivery once (P1)

The maintainer follows the setup guide to supply the app certificate, installer certificate, provisioning profile, and existing upload key. Credentials are never committed or included in downloadable workflow artifacts.

## Requirements

- **FR-001**: The actual build/upload MUST run from a numeric release tag named `v<version>` and use that version for packaging and verification. Branches, other tags, invalid release versions, and requested/tagged version mismatches MUST be rejected before entering the credential-bearing job. Creating a tag MUST NOT automatically trigger Store delivery.
- **FR-002**: The Store app identifier MUST be `dev.yetanotherchris.markdownmeister`.
- **FR-003**: The package MUST support both Intel and Apple silicon and use Store app and installer signing identities belonging to the provisioning profile's team.
- **FR-004**: Delivery MUST verify the app signature, embedded provisioning profile, product version, build number, processor architectures, sandbox entitlement, and installer signature before upload.
- **FR-005**: Delivery MUST use protected credentials and remove temporary credential files even after failure.
- **FR-006**: Upload validation and upload failures MUST fail the run. Upload success MUST NOT be described as completed processing, review approval, or public release.
- **FR-007**: The maintainer MUST be able to build without uploading, and override the build number for retries.
- **FR-008**: The guide MUST name all secrets, explain reuse of the existing upload API key, and document starting delivery and completing review.
- **FR-009**: The Store package MUST use the platform sandbox with user-selected read/write access, without granting unrestricted filesystem access.
- **FR-010**: The delivery form MUST provide a required version textbox accepting a release version without `v`. Starting from the primary branch MUST launch the corresponding tagged build without accessing Store credentials, preserving build-number and upload selections. The run summary MUST distinguish launching the build from completing the build or upload.

## Assumptions

- Delivery builds the manually selected release tag and derives its product version from the tag, matching the direct-download release process. The tagged source metadata may still contain the previous version. Uploading to the Store remains a separate manual action.
- Upload credentials are supplied in the existing `macos-signing` deployment environment, reusing the existing API key without duplicating its secrets.
- This feature implements package delivery. A signed Store build still requires testing through the Store testing channel or a separately development-signed build before public review. Automated signature checks do not establish that folder permissions persist after relaunch.

## Clarifications

### 2026-10-25

- The maintainer confirmed the registered bundle identifier is `dev.yetanotherchris.markdownmeister`.
- The maintainer already has the other signing credentials and API key and is creating the installer certificate.
- The installer secrets were added to the existing `macos-signing` environment. Delivery reuses that environment and its existing API-key secrets.
- After a main-branch dispatch was rejected by the environment's `v*` tag-only rule, the maintainer requested manual `v*` tag dispatch. Select a release tag containing the updated workflow. Its name supplies the packaged product version, as with direct-download releases; it does not need to match the version already in source metadata.
- The maintainer prefers a version textbox like the Microsoft Store form, rather than a command-line dispatch. The primary-branch form launches a tagged build so the signing environment can retain its `v*` tag-only rule. A launcher run is not a completed upload.

## Success Criteria

- A delivery run retains one universal signed package and reports whether upload was requested and accepted.
- Invalid profile identity, expired profiles, wrong architectures, invalid signatures, and upload rejection prevent a successful delivery.
- The maintainer can configure and run delivery using the guide without reading workflow source.
