# Tasks: Apple Direct Distribution

## Phase 1: Packaging Foundation

- [x] T001 Add the minimal hardened-runtime entitlement plist for Electron JIT.
- [x] T002 Configure macOS packaging to use hardened runtime, inherited entitlements, and an `afterSign` hook.
- [x] T003 Add an explicit `@electron/notarize` development dependency.
- [x] T004 Implement the `afterSign` hook that validates credentials, notarizes, and staples the signed app.

## Phase 2: Final Artifact Verification

- [x] T005 Implement verification of signatures, Developer ID identity, hardened runtime, stapling, and Gatekeeper assessment for the app in final DMG and ZIP artifacts.
- [x] T006 Add unit coverage for artifact selection, required verification commands, and command failures.

## Phase 3: Release Automation

- [x] T007 Provision a temporary macOS keychain, certificate, and App Store Connect key from protected Actions secrets for each macOS matrix leg.
- [x] T008 Run final-artifact verification before macOS artifact upload and clean credential material in an always-running step.
- [x] T009 Preserve the existing all-or-nothing release dependency and artifact names.

## Phase 4: Documentation and Validation

- [x] T010 Document notarized macOS direct downloads in the README without Gatekeeper-bypass advice.
- [ ] T011 Run format, lint, typecheck, unit, and e2e quality gates. (Partial: format check has existing repository-wide line-ending failures; e2e exceeded the local command limit after 345 passing tests.)
- [ ] T012 Verify a tagged release after configuring repository secrets.
- [x] T013 Remove the custom environment-protection preflight and its obsolete validator tests. Update setup instructions to make deployment protection optional. Verification: lint, typecheck, all 1,149 unit tests (including release tests), and workflow formatting passed.
