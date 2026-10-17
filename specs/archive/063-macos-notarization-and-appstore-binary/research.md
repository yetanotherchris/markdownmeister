# Research: Apple Direct Distribution

## R1: Distribution route

Developer ID signing plus notarization is the correct route for the existing GitHub Release and Homebrew downloads. The Mac App Store requires sandboxing and is explicitly deferred by the specification. The directory name is retained at the user's request, but this feature does not submit to the Mac App Store.

Electron's code-signing guide requires signing before notarization. `@electron/notarize` states that macOS verifies a stapled ticket locally when a user is offline. This satisfies the direct-download requirement without changing runtime folder access.

## R2: Authentication and secret handling

The release workflow must import a Developer ID Application `.p12` certificate into a temporary keychain using `CSC_LINK` and `CSC_KEY_PASSWORD`. An App Store Connect team API key authenticates notarization through `@electron/notarize` using a temporary `.p8` file. The required Actions secrets are:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY_P8_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `MACOS_SIGNING_IDENTITY`
- `MACOS_KEYCHAIN_PASSWORD`

GitHub Actions documentation recommends providing secrets through environment variables and supports base64-encoded binary content. The workflow decodes the certificate and API key only on the macOS runner, imports the certificate into a temporary keychain, and deletes temporary files through an `always()` cleanup step. No secret value or certificate is committed.

## R3: Signing and hardened runtime

`electron-builder` signs the application and nested Electron frameworks when macOS certificate discovery is enabled through `CSC_LINK`. The macOS configuration enables the hardened runtime and supplies a minimal entitlement plist that grants only `com.apple.security.cs.allow-jit`. Electron's notarization documentation identifies JIT as the legitimate hardened-runtime entitlement required by modern Electron applications. The same entitlement applies to inherited helper-process signing.

## R4: Notarization and archive ordering

An `afterSign` hook runs after `electron-builder` has signed the `.app`, submits that exact app bundle through Apple's `notarytool` API, waits for the result, and staples the returned ticket. DMG and ZIP targets are created afterwards, so their contained app carries the ticket. This is necessary because a ZIP itself cannot be stapled.

The hook rejects missing credential values and propagates Apple failures. The macOS matrix leg then fails before artifact upload, which prevents the `release` job and preserves spec 005's all-or-nothing rule.

## R5: Final-artifact verification

A macOS-only verification script validates every produced architecture's final artifacts before upload:

- attaches each DMG, locates `MarkdownMeister.app`, and runs `codesign --verify --deep --strict`, `spctl --assess`, and `stapler validate`;
- extracts each ZIP into a temporary directory and runs the same checks on its app bundle;
- checks the expected Developer ID identity and hardened-runtime flag with `codesign --display --verbose=4`;
- applies the macOS quarantine attribute to the final DMG and ZIP before their respective Gatekeeper assessments.

The verification runs on the architecture-specific macOS matrix runner, which is the only portable way to validate both x64 and arm64 release artifacts in CI. A release cannot reach the draft or package-definition update steps until both macOS matrix legs succeed.

## Sources

- Electron: [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- Electron: [@electron/notarize](https://github.com/electron/notarize)
- GitHub: [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
