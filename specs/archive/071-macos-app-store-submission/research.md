# Research: Mac App Store Build Upload

## Store packaging

Electron's [Mac App Store guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide) requires the MAS Electron build and Apple's App Sandbox. Distribution-signed apps cannot be launched directly for local testing. Development-signed builds need a registered device and development provisioning profile.

The installed electron-builder implementation (`node_modules/app-builder-lib/out/macPackager.js`, `mac/MacTargetHelper.js`) selects MAS Electron for the `mas` target, supports universal merging, signs with Apple Distribution or the legacy app distribution identity, and uses the legacy-named Mac Installer Distribution identity for `productbuild`. `CSC_LINK` and `CSC_INSTALLER_LINK` accept separate certificate exports. MAS now invokes the global `afterSign` hook, so the Store configuration must disable the direct-download notarization hook.

## Upload

Apple's [upload guide](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) documents command-line validation and upload with Xcode's `altool`. The workflow uses API-key authentication, with the key placed in its documented `$HOME/.private_keys` search directory. Validation precedes upload. No automatic retry follows an upload error because a request may already have reached Apple.

## Verification and local constraints

Python's standard library provides strict base64 decoding, plist parsing, file permissions, subprocess execution, and unit tests without another dependency. macOS `security`, `codesign`, `pkgutil`, and `lipo` perform profile and artifact verification. Windows can execute the regression tests and validate syntax, but cannot produce or validate a signed MAS installer or contact Apple without the maintainer's secrets.

The app currently stores recent paths without security-scoped bookmarks. This delivery work does not establish persistent sandbox access. A Store-channel runtime test covering opening a folder, atomic saves, settings, and relaunch is required before public review; failures need a separate app-behavior specification rather than broad filesystem entitlements.
