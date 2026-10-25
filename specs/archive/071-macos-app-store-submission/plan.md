# Implementation Plan: Mac App Store Build Upload

## Approach

Add a manually dispatched GitHub workflow with an unprivileged release-tag preflight followed by a macOS job using the existing `macos-signing` environment. Check out the dispatched tag and require a full `refs/tags/v<version>` ref with a valid numeric release version before entering the environment job. Derive the product version from that tag for all delivery commands and pass it to electron-builder as `extraMetadata.version`, matching the direct-download release workflow even when package.json still has the previous version. Use a dedicated electron-builder configuration extending the existing configuration, overriding only Store identity, target, sandbox entitlements, output location, signing enforcement, and the direct-download notarization hook.

Use one Python delivery helper for credential preparation, provisioning-profile checks, final artifact checks, and API-key upload. Keep secret contents out of command arguments and artifacts. Use a temporary credential directory, electron-builder's temporary signing keychain, and unconditional cleanup. Keep the API private key in a temporary HOME search directory used only by altool.

Use a positive numeric build number of at most four digits, defaulting to the workflow run number. Overrides allow upload retries with higher numbers. The product version comes from the selected release tag and must be a three-part numeric release version accepted by Apple.

## Constitution Check

Renderer isolation, named preload operations, main-process path containment, atomic writes, and dirty-state behavior are preserved. The Store entitlement grants user-selected read/write access, not arbitrary access outside the sandbox. No constitution deviations.

## Verification

Run Python unit tests for invalid inputs, provisioning-profile mismatches, certificate/profile alignment, artifact verification failures, and upload error propagation. Validate Python and configuration syntax, the builder schema, workflow YAML and shell syntax, and the final diff. Signed packaging and live upload require a macOS runner and the maintainer's credentials. Store-channel runtime acceptance remains explicitly unverified until that build is tested.

## Decision Log

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
