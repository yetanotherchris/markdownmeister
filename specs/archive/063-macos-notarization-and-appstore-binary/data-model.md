# Data Model: Apple Direct Distribution

## Signing credentials

| Field | Source | Rule |
| --- | --- | --- |
| Developer ID certificate | `MACOS_CERTIFICATE_P12_BASE64` | Imported only into the current macOS runner's temporary keychain. |
| Certificate password | `MACOS_CERTIFICATE_PASSWORD` | Used only during certificate import. |
| API key | `APPLE_API_KEY_P8_BASE64` | Decoded to an ephemeral `.p8` file for notarization. |
| API key ID | `APPLE_API_KEY_ID` | Passed to `notarytool` through the notarization hook. |
| API issuer | `APPLE_API_ISSUER` | Passed to `notarytool` through the notarization hook. |
| Signing identity | `MACOS_SIGNING_IDENTITY` | Expected full Developer ID Application identity verified inside each final archive. |
| Keychain password | `MACOS_KEYCHAIN_PASSWORD` | Encrypts the short-lived CI keychain. |

All fields are protected GitHub Actions secrets and must be non-empty for a macOS release leg.

The `macos-signing` deployment environment holds these secrets. It must restrict deployments to `main` tags and require an independent reviewer before the build matrix begins, preventing a tag-triggered workflow change from immediately accessing signing material.

## Signed application bundle

| Field | Rule |
| --- | --- |
| Identity | Must be a `Developer ID Application` certificate. |
| Hardened runtime | Enabled for the app and inherited helper executables. |
| Entitlements | Only the Electron JIT entitlement is declared. |
| Notarization | Apple accepts the signed app and its ticket is stapled before archiving. |

## Verified release artifact

| Field | Rule |
| --- | --- |
| Format | One DMG and one ZIP for each of x64 and arm64. |
| Version | Derived from the release tag and embedded in the filename and app bundle. |
| Contents | Contains the signed, stapled `MarkdownMeister.app`. |
| Gatekeeper state | Passes assessment after quarantine is applied to the final archive. |
| Publication | Uploaded only after final-artifact verification succeeds. |
