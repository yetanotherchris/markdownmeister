# Implementation Plan: Mac App Store Build Upload

## Approach

Add a manually dispatched GitHub workflow with an unprivileged primary-branch preflight followed by a macOS job using the existing `macos-signing` environment. Build current main rather than introducing tag requirements. Use a dedicated electron-builder configuration extending the existing configuration, overriding only Store identity, target, sandbox entitlements, output location, signing enforcement, and the direct-download notarization hook.

Use one Python delivery helper for credential preparation, provisioning-profile checks, final artifact checks, and API-key upload. Keep secret contents out of command arguments and artifacts. Use a temporary credential directory, electron-builder's temporary signing keychain, and unconditional cleanup. Keep the API private key in a temporary HOME search directory used only by altool.

Use a positive numeric build number of at most four digits, defaulting to the workflow run number. Overrides allow upload retries with higher numbers. The product version comes from package.json and must be a three-part numeric release version accepted by Apple.

## Constitution Check

Renderer isolation, named preload operations, main-process path containment, atomic writes, and dirty-state behavior are preserved. The Store entitlement grants user-selected read/write access, not arbitrary access outside the sandbox. No constitution deviations.

## Verification

Run Python unit tests for invalid inputs, provisioning-profile mismatches, certificate/profile alignment, artifact verification failures, and upload error propagation. Validate Python and configuration syntax, the builder schema, workflow YAML and shell syntax, and the final diff. Signed packaging and live upload require a macOS runner and the maintainer's credentials. Store-channel runtime acceptance remains explicitly unverified until that build is tested.

## Decision Log

- 2026-10-25: Use a Store-specific app identifier override because the registered identifier differs from the current direct-download identifier.
- 2026-10-25: Use a separate workflow and artifact directory so the Store package can be uploaded independently.
- 2026-10-25: Retain the package before upload so a rejected upload does not discard build evidence. Never retain certificates, keys, or decoded profiles as separate artifacts.
- 2026-10-25: GitHub secret-name inspection confirmed the installer credentials and API key are already in `macos-signing`. Reuse that environment and map `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` to the helper's internal variables. No secret values were retrieved.

## Complexity Tracking

No constitution deviations.

## Local Verification Results (2026-10-25)

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 96 files and 1,159 tests. The Store regression wrapper runs 23 Python regression tests; the second Store test loads and schema-validates the merged builder configuration.
- `npm run test:e2e -- tests/e2e/app.spec.ts tests/e2e/save-opened-file.spec.ts tests/e2e/settings.spec.ts tests/e2e/recent.persistence.spec.ts tests/e2e/file-association.spec.ts`: passed, 51 tests on Windows.
- `npm run test:e2e`: incomplete. The initial full run reached the command's 120-second timeout after 33 passing tests. No full-suite success is claimed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest -shellcheck= .github/workflows/build-macos-store.yml`: passed. ShellCheck is not installed; each of the workflow's 11 shell blocks also passed Git Bash `bash -n` syntax validation.
- Changed JavaScript/TypeScript and workflow files passed targeted ESLint/Prettier checks. The actual builder configuration loader and schema validation passed.
- Docker's Linux engine is unavailable locally, so Linux-container e2e was not run.
- Signed universal MAS packaging, Apple's validation/upload, and Store-channel runtime behavior remain unverified. They require a macOS runner with the configured signing credentials, followed by testing the processed Store build or a separately development-signed MAS build.

The implementation artifacts are archived with the implementation PR. The macOS verification task remains open and must be completed before public review. No public Store-readiness claim is made by the local checks.
