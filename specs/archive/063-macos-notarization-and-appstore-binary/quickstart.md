# Quickstart: Apple Direct Distribution

## One-time GitHub configuration

1. Create a Developer ID Application certificate in the Apple Developer portal and export it with its private key as a password-protected `.p12` file.
2. Create an App Store Connect team API key with App Manager access and download its `.p8` file. Record its key ID and issuer ID.
3. Create a protected `macos-signing` deployment environment that permits `main` tags only and requires an independent reviewer. Add the following environment secrets: `MACOS_CERTIFICATE_P12_BASE64`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `MACOS_SIGNING_IDENTITY`, and `MACOS_KEYCHAIN_PASSWORD`. The two file secrets contain single-line base64 output. `MACOS_SIGNING_IDENTITY` is the full `Developer ID Application: Name (TEAMID)` certificate identity.
4. Do not add these files or values to the repository.

## Release verification

1. Push a valid tag from `main`.
2. Confirm both macOS matrix legs import the certificate, notarize successfully, staple the app, and pass final-artifact verification.
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
