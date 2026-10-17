# Release Contract: Apple Direct Distribution

## macOS build inputs

Each macOS matrix leg receives the five signing and notarization secrets named in [data-model.md](../data-model.md). A missing or invalid value terminates the leg before packaging. Secrets must never appear in logs, artifacts, source control, or the published release.

## Packaging sequence

1. Create a temporary macOS keychain and import the Developer ID Application certificate.
2. Build the application with hardened runtime and the committed minimal entitlements.
3. Sign the app and nested executables through `electron-builder`.
4. Run the `afterSign` notarization hook with the temporary App Store Connect API key.
5. Staple Apple's notarization ticket to the signed app.
6. Build the architecture-specific DMG and ZIP from that stapled app.
7. Verify the app inside each final archive before uploading release artifacts.
8. Delete the temporary keychain, certificate, and API key on every outcome.

## Failure contract

An error in certificate import, signing, notarization, stapling, or final-artifact verification fails its macOS matrix leg. The `release` job continues to require every matrix leg, so it cannot create even a draft release, update Homebrew or Scoop, commit package definitions, or publish the tag's release.

## Artifact contract

The existing artifact names remain unchanged:

- `markdownmeister-<version>-macos-x64.dmg`
- `markdownmeister-<version>-macos-x64.zip`
- `markdownmeister-<version>-macos-arm64.dmg`
- `markdownmeister-<version>-macos-arm64.zip`

The Homebrew formula continues to consume the ZIP artifacts with the same filenames.
