# Implementation Plan: Apple Direct Distribution

**Branch**: `spec-063-apple-appstore-distribution` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

## Summary

Add Developer ID signing and Apple notarization to the existing macOS GitHub Release artifacts. The release workflow will import protected credentials only on macOS runners, sign a hardened app bundle, notarize and staple it before DMG and ZIP creation, and verify the app inside every final archive before artifact upload. This is direct distribution, not a Mac App Store submission or sandboxing change.

## Technical Context

**Language/Version**: JavaScript ESM for packaging hooks and verification scripts, YAML for release automation, XML plist for macOS entitlements. The Electron application remains TypeScript 5.8 strict and is unchanged.

**Primary Dependencies**: Existing `electron-builder` handles Developer ID signing. Add `@electron/notarize` as an explicit development dependency for its supported `notarytool` integration. No runtime dependency is added.

**Testing**: Unit-test archive-verification command construction and failure handling. The macOS release matrix performs the real signing, notarization, stapling, quarantine, and Gatekeeper checks. Run the existing lint, typecheck, unit, and Playwright e2e gates because scripts and packaging inputs change.

**Target Platform**: macOS x64 and arm64 release runners. Windows and Linux packaging remain unchanged.

**Constraints**: Credentials are GitHub Actions secrets only. The app remains unsandboxed, retains its existing bundle identifier, document associations, folder access, and artifact filenames. A failure in either macOS build still prevents all public release and package-definition updates under spec 005.

## Constitution Check

| Principle | Status | Reason |
| --- | --- | --- |
| I. Process Isolation Is Absolute | PASS | CI and packaging changes do not add renderer, Node, or Electron access. |
| II. Every Path Is Untrusted | PASS | No runtime file operation or IPC surface changes. |
| III. Never Lose The User's Words | PASS | No save, document, or workspace behavior changes. |
| IV. Calm, Predictable Editing | PASS | The feature runs only while packaging; app interaction is unchanged. |
| V. Test What Can Corrupt Or Escape | PASS | New verification logic gets unit coverage and required release evidence runs on macOS CI. |

## Design

2026-10-23 repair: the release findings in `temp/RELEASE-ARTIFACT-FINDINGS.md` report valid local DMGs but corrupt published DMGs after overlapping artifact downloads. Preserve the existing repair that builds one signed app per runner and creates archives with system `hdiutil create -srcfolder` and `ditto`. Remove target-level architecture overrides and isolate downloads to eliminate shared destination paths. Verify image checksums and contained apps both before upload and after download in the release job.

The notarization hook inspects the actual app signature with `codesign --display`. An unsigned or ad-hoc local app skips notarization; CI rejects it. A Developer ID app must pass strict signature verification and supply all notarization credentials. Unexpected inspection failures are errors rather than a reason to skip notarization.

The macOS build job provisions a temporary keychain and key files from Actions secrets. It passes `CSC_LINK` and `CSC_KEY_PASSWORD` to `electron-builder`, which signs the app and its nested binaries. The macOS configuration enables hardened runtime and uses a committed entitlement plist containing only Electron's JIT permission.

`electron-builder` invokes an `afterSign` hook after the `.app` is signed. The hook validates the API-key environment, notarizes the precise signed app using `@electron/notarize`, and staples the ticket. Only then does packaging create the DMG and ZIP targets. A verification script mounts/extracts those final archives, applies quarantine, and executes signature, hardened-runtime, ticket, and Gatekeeper checks against their contained app.

## Project Structure

```text
packaging/macos/
└── entitlements.plist                 # NEW: minimal hardened-runtime permissions

scripts/
├── notarize-macos.mjs                 # NEW: electron-builder afterSign hook
└── verify-macos-artifacts.mjs         # NEW: final DMG and ZIP verification

tests/scripts/
└── verify-macos-artifacts.test.ts     # NEW: verification command and failure coverage

.github/workflows/build-release.yml    # MODIFY: secret provisioning, notarization, verification
electron-builder.yml                   # MODIFY: hardened runtime, entitlements, afterSign hook
package.json                           # MODIFY: explicit notarization dependency
package-lock.json                      # MODIFY: lock the dependency
README.md                              # MODIFY: document signed, notarized macOS downloads
```

## Complexity Tracking

No constitution violations. A temporary keychain and files are necessary to use CI-held cryptographic credentials without committing them. The simpler alternative, embedding credentials or signing only on a personal Mac, violates the credential and automated-verification requirements.

## Implementation Phases

1. Add hardened-runtime configuration, minimal entitlements, and the notarization hook.
2. Add final-artifact verification and its unit coverage.
3. Wire protected credential provisioning, signing, notarization, verification, and cleanup into both macOS release legs.
4. Document the user-facing macOS direct-download behavior and maintainer setup.
5. Run local quality gates. Real notarization is verified by the first tag workflow after repository secrets are configured.
