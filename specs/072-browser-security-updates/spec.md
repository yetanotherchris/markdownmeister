# Specification: Browser Security Updates

**Feature Branch**: `spec-072-browser-security-updates`

**Created**: 2026-11-02

**Status**: Planned

**Input**: Update the browser components identified by the security review. The user approved using the stable browser channel for documentation tests rather than the test runner's bundled browser.

## User Scenarios & Testing

### User Story 1: Run the editor with patched browser components (P1)

Users can continue opening, editing, and saving their documents with an updated desktop runtime, without losing the application's existing isolation or confirmation protections.

Acceptance scenarios:

1. Given the updated application, when it starts, its maintained runtime includes the published security updates for its release line and the existing editing and file-operation acceptance tests still pass. Any unverified individual browser vulnerability coverage is reported.
2. Given the editor window, when document content attempts to access host process primitives or open another window, direct host access remains unavailable and the popup is denied.

### User Story 2: Test documentation with a patched browser (P1)

Maintainers run documentation tests against an installed stable browser rather than the older browser bundled with the test runner.

Acceptance scenarios:

1. Given a current stable browser installation, when documentation tests run, they use that browser and pass the existing site acceptance scenarios.
2. Given the Linux test image, when it is built, it installs the stable test browser and uses the updated test tooling.
3. Given a machine without that browser, when a maintainer follows the testing instructions, the prerequisite and installation command are explicit.

## Requirements

- **FR-001**: Update the desktop runtime within its current maintained release line to include published security fixes, preserving existing platform support. Report individual browser vulnerability coverage that cannot be verified from public backport information.
- **FR-002**: Preserve existing editing, filesystem, process-isolation, navigation, and unsaved-change behavior. Do not widen permissions to accommodate the update.
- **FR-003**: Update browser automation and its pinned Linux test image together.
- **FR-004**: Documentation tests must use an installed stable browser without silently falling back to the older bundled browser.
- **FR-005**: Document the browser prerequisite and retain automated checks for the selected browser and runtime isolation settings.
- **FR-006**: Keep unrelated dependency advisories outside this change and report any remaining verification gaps rather than claiming a clean security audit.

## Clarifications

- 2026-11-02: The user selected the stable browser channel for documentation tests. Application tests continue to exercise the desktop runtime itself.
- 2026-11-02: The user selected a patched release of the current desktop runtime line rather than the latest major release, preserving support for the existing operating-system versions. A newer upstream browser version number is not required for the application when using the maintained backport line.

## Assumptions

- No new product functionality or appearance is intended. Existing acceptance suites cover editing and file operations; a focused runtime security suite covers the upgraded runtime and unchanged isolation settings.

## Success Criteria

- The application runs with the selected patched runtime, and its lint, typecheck, unit tests, and full application acceptance suite pass.
- The documentation acceptance suite passes against the installed stable browser.
- The dependency audit no longer reports the reviewed desktop-runtime advisories. Remaining unrelated advisories and unavailable platform checks are recorded.
