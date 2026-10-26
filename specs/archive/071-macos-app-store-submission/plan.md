# Implementation Plan: Mac App Store Build Upload

## Approach

The primary-branch UI offers a required version textbox. A credential-free Ubuntu launcher validates the version/build-number inputs, then uses GitHub CLI to dispatch this workflow at `v<version>`, passing through the version, optional build number, and upload choice. Only this job has `actions: write`, using the built-in repository token; it has no deployment environment or Store secrets. Tagged runs skip the launcher and retain the strict preflight and signing job below. Launcher and build runs have separate concurrency groups and descriptive run names. The launcher never waits for the child, and its summary links to the workflow page without claiming build or upload completion.

Add a manually dispatched GitHub workflow with an unprivileged release-tag preflight followed by a macOS job using the existing `macos-signing` environment. Check out the dispatched tag and require a full `refs/tags/v<version>` ref with a valid numeric release version before entering the environment job. Derive the product version from that tag for all delivery commands and pass it to electron-builder as `extraMetadata.version`, matching the direct-download release workflow even when package.json still has the previous version. Use a dedicated electron-builder configuration extending the existing configuration, overriding only Store identity, target, sandbox entitlements, output location, signing enforcement, and the direct-download notarization hook.

Use one Python delivery helper for credential preparation, provisioning-profile checks, final artifact checks, and API-key upload. Keep secret contents out of command arguments and artifacts. Use a temporary credential directory, electron-builder's temporary signing keychain, and unconditional cleanup. Keep the API private key in a temporary HOME search directory used only by altool.

Use a positive numeric build number of at most four digits, defaulting to the workflow run number. Overrides allow upload retries with higher numbers. The product version comes from the selected release tag and must be a three-part numeric release version accepted by Apple.

## Constitution Check

Renderer isolation, named preload operations, main-process path containment, atomic writes, and dirty-state behavior are preserved. The Store entitlement grants user-selected read/write access, not arbitrary access outside the sandbox. No constitution deviations.

## Verification

Run Python unit tests for invalid inputs, provisioning-profile mismatches, certificate/profile alignment, artifact verification failures, and upload error propagation. Validate Python and configuration syntax, the builder schema, workflow YAML and shell syntax, and the final diff. Signed packaging and live upload require a macOS runner and the maintainer's credentials. Store-channel runtime acceptance remains explicitly unverified until that build is tested.

## Decision Log

- 2026-10-26: Actual installer payload inspection identified the mode-0600 embedded profile and sidecar as the only non-root-unreadable entries behind Apple's 90255 rejection. Create a separate mode-0644 packaging copy inside the mode-0700 credential directory before signing, leaving the private original and keys at 0600. Verify all installed-app file and directory modes before upload, without modifying signed content. Evidence is recorded in research.md.
- 2026-10-26: The maintainer explicitly requested pushing this repair to main without a PR and continuing live GHA testing, then approved creating v1.8.63 with its normal public-release side effect. Keep the existing v1.8.62 tag unchanged.
- 2026-10-25: The maintainer requested UI-based operation with the same version textbox as the Microsoft Store workflow. A main-to-tag workflow dispatch preserves the existing tag-only signing environment rule. Scope `actions: write` to the launcher job and retain `contents: read` elsewhere. Validate the entered version on main and require it to match the dispatched tag before any credential-bearing job. Existing tags must contain this version-input workflow interface to receive the forwarded inputs.
- 2026-10-25: Run 40233344948 was rejected before the macOS job because `macos-signing` allows `v*` tags and excludes `main`. At the maintainer's request, keep manual dispatch but require a release tag. Validate the full ref and numeric version in an unprivileged job before the environment job and again before macOS credential preparation. Select a tag containing this workflow change; old tags retain their old workflow definition. Derive the version from the tag, rather than requiring package.json to match, because the regular release workflow overrides metadata at packaging and synchronizes package.json afterward.
- 2026-10-25: Use a Store-specific app identifier override because the registered identifier differs from the current direct-download identifier.
- 2026-10-25: Use a separate workflow and artifact directory so the Store package can be uploaded independently.
- 2026-10-25: Retain the package before upload so a rejected upload does not discard build evidence. Never retain certificates, keys, or decoded profiles as separate artifacts.
- 2026-10-25: GitHub secret-name inspection confirmed the installer credentials and API key are already in `macos-signing`. Reuse that environment and map `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` to the helper's internal variables. No secret values were retrieved.
- 2026-10-25: Correctness review established that sandbox entitlements need checking on the signed app, not authorization in the provisioning profile, and that codesign's optional certificate prefix must be attached to the option. Correct both with regressions that exercise those command and profile contracts. Strengthen the signature-failure regression so removing signature verification causes a test failure.

## Complexity Tracking

No constitution deviations.

## Local Verification Results (2026-10-25)

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 96 files and 1,159 tests before review corrections. After the corrections, `npm run test -- tests/main/macos-store.test.ts` passed with 24 Python regression tests; the second Store test loads and schema-validates the merged builder configuration.
- `npm run test:e2e -- tests/e2e/app.spec.ts tests/e2e/save-opened-file.spec.ts tests/e2e/settings.spec.ts tests/e2e/recent.persistence.spec.ts tests/e2e/file-association.spec.ts`: passed, 51 tests on Windows.
- `npm run test:e2e`: incomplete. The initial full run reached the command's 120-second timeout after 33 passing tests. No full-suite success is claimed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest -shellcheck= .github/workflows/build-macos-store.yml`: passed. ShellCheck is not installed; each of the workflow's 11 shell blocks also passed Git Bash `bash -n` syntax validation.
- Changed JavaScript/TypeScript and workflow files passed targeted ESLint/Prettier checks. The actual builder configuration loader and schema validation passed.
- Docker's Linux engine is unavailable locally, so Linux-container e2e was not run.
- Signed universal MAS packaging, Apple's validation/upload, and Store-channel runtime behavior remain unverified. They require a macOS runner with the configured signing credentials, followed by testing the processed Store build or a separately development-signed MAS build.

The implementation artifacts are archived with the implementation PR. The macOS verification task remains open and must be completed before public review. No public Store-readiness claim is made by the local checks.

## Release-Tag Dispatch Fix Verification (2026-10-25)

- `npm run test -- tests/main/macos-store.test.ts`: passed, including 28 Python regressions and builder configuration/schema validation with a version override. New coverage rejects branches, non-release tags, and invalid numeric versions. The actual CLI derives the version from a release tag even when package.json has another version.
- Actionlint and targeted workflow Prettier validation passed. The actual workflow tag gate was exercised with Git Bash against main, a branch named like a tag, a non-release tag, and a `v` release tag; all expected statuses matched. The workflow has only a manual trigger, its preflight has no environment, and the macOS job depends on that preflight. All 12 shell blocks passed `bash -n`.
- `git diff --check`: passed. No live Store run or environment-rule change was performed.
- Targeted ESLint and Prettier checks passed for the changed wrapper test and workflow.
- After PR review, the targeted Vitest suite passed all three tests, including the new credential-free workflow regression. It parses the actual workflow, requires an unprivileged preflight and its dependency, and runs the workflow's gate/helper combination against main, a tag-like branch, malformed and invalid numeric tags, and a valid release tag.

## UI Launcher Verification (2026-10-25)

- The targeted Vitest suite passed all three tests with 30 Python regressions. New cases validate plain version entry on main and reject mismatched requested/tagged versions before credential preparation, verification, or upload.
- The workflow regression parses the real launcher, checks its main-only condition and job-scoped dispatch permission without a signing environment, and executes its actual validation and dispatch shell with a stub GitHub CLI. It verifies forwarding of blank and explicit build numbers and both upload choices, and propagates dispatch failure. No real token or Store credential is used.
- After review, the regression also asserts that the workflow binds the requested version, build-number override, and upload flag to their actual form inputs, rather than hardcoding values. This complements executing the launcher shell with both upload choices.
- Actionlint and targeted ESLint passed. Prettier passed with checkout line endings normalized to LF; the direct Windows file check reports CRLF differences. All workflow shell blocks also pass Git Bash syntax validation. ShellCheck is unavailable locally.
- No workflow was dispatched and no environment policy was modified. The real UI-to-tag dispatch still requires merging the change and selecting an existing tag containing the new workflow interface. Signed Store packaging and upload remain unverified.

## Profile Permission Fix Verification (2026-10-26)

- The actual v1.8.62 installer artifact was inspected without extracting application files. Among 813 payload entries, only the embedded profile and its AppleDouble sidecar lacked non-root read access; each had UID/GID 0 and mode 0600.
- `npm run test -- tests/main/macos-store.test.ts`: passed, three Vitest tests covering 34 Python regressions and builder/workflow wiring. Credential preparation tests prove that the packaging copy is byte-identical and receives mode 0644 while the original profile, signing exports, and API key retain mode 0600 within a mode-0700 directory.
- Regression coverage rejects owner-only and group-only files, non-root-unsearchable directories, and executables missing non-root execute access, and verifies that bundle-permission failures stop delivery before signature/upload checks. Symlink mode bits are excluded.
- Actionlint, targeted ESLint, normalized-line-ending Prettier, and diff whitespace checks passed. Live validation of the corrected package is tracked in T014.

## Live Store Delivery Result (2026-10-26)

Commit 335cd41 was pushed to main as requested, and the approved release tag v1.8.63 was created at that commit. The UI launcher run 40308661061 dispatched tagged build [40308677407](https://github.com/yetanotherchris/markdownmeister/actions/runs/40308677407). The tagged run completed successfully: universal MAS packaging and signing, bundle permission/signature/profile verification, package retention, Apple's package validation, and App Store Connect upload all passed. Artifact `macos-app-store-15-1` contains the verified installer.

This verifies the permissions fix against Apple's actual validation service. The separate regular release workflow was also triggered by the approved tag. App Store Connect processing, Store-channel runtime tests, App Review submission, and public Store release are not claimed complete; T007 remains outstanding.
