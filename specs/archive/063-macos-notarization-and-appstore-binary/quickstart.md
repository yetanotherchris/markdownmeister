# Quickstart: Apple Direct Distribution

## One-time GitHub configuration

1. Create a Developer ID Application certificate in the Apple Developer portal and export it with its private key as a password-protected `.p12` file.
2. Create an App Store Connect team API key with App Manager access and download its `.p8` file. Record its key ID and issuer ID.
3. Create a protected `macos-signing` deployment environment that permits `main` tags only and requires an independent reviewer. Add the following environment secrets: `MACOS_CERTIFICATE_P12_BASE64`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `MACOS_SIGNING_IDENTITY`, and `MACOS_KEYCHAIN_PASSWORD`. The two file secrets contain single-line base64 output. `MACOS_SIGNING_IDENTITY` is the full `Developer ID Application: Name (TEAMID)` certificate identity.
4. Do not add these files or values to the repository.

Check secret names with `gh secret list --env macos-signing`. As of 2026-10-23, this returned no secrets. Supply all seven values before retrying a release. Use `gh secret set <NAME> --env macos-signing` interactively for each value; do not paste private keys or passwords into issues, PRs, or chat. The release verification job also uses this environment to read `MACOS_SIGNING_IDENTITY`.

## Release verification

1. Push a valid tag from `main`.
2. Confirm both macOS matrix legs import the certificate, notarize successfully, staple the app, and pass final-artifact verification. Each leg must upload only its selected architecture. The release job must download into separate build directories, assemble exactly eight expected files, and verify both downloaded macOS architectures before creating a draft release.
3. Confirm a signing or notarization failure prevents the release job from starting and leaves Homebrew and Scoop definitions unchanged.
4. Download each published macOS DMG and ZIP on its matching architecture. Confirm the app opens normally after browser quarantine and with networking disabled.
5. Install with Homebrew and confirm `MarkdownMeister.app` launches normally.

## Local macOS inspection

On a macOS machine, inspect an extracted app with:

```sh
codesign --verify --deep --strict --verbose=2 MarkdownMeister.app
spctl --assess --type execute --verbose=4 MarkdownMeister.app
xcrun stapler validate MarkdownMeister.app
```

The app must report a Developer ID signature, accepted Gatekeeper assessment, and a valid stapled ticket.

For unsigned local development builds, `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 --publish never` may skip notarization without Apple credentials. This exemption does not apply in CI or to Developer ID-signed apps. A local unsigned build is not a distributable release.
