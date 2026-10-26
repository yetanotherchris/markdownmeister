# Research: Mac App Store Build Upload

## Store packaging

Electron's [Mac App Store guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide) requires the MAS Electron build and Apple's App Sandbox. Distribution-signed apps cannot be launched directly for local testing. Development-signed builds need a registered device and development provisioning profile.

The installed electron-builder implementation (`node_modules/app-builder-lib/out/macPackager.js`, `mac/MacTargetHelper.js`) selects MAS Electron for the `mas` target, supports universal merging, signs with Apple Distribution or the legacy app distribution identity, and uses the legacy-named Mac Installer Distribution identity for `productbuild`. `CSC_LINK` and `CSC_INSTALLER_LINK` accept separate certificate exports. MAS now invokes the global `afterSign` hook, so the Store configuration must disable the direct-download notarization hook.

## Upload

Apple's [upload guide](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) documents command-line validation and upload with Xcode's `altool`. The workflow uses API-key authentication, with the key placed in its documented `$HOME/.private_keys` search directory. Validation precedes upload. No automatic retry follows an upload error because a request may already have reached Apple.

## Verification and local constraints

Python's standard library provides strict base64 decoding, plist parsing, file permissions, subprocess execution, and unit tests without another dependency. macOS `security`, `codesign`, `pkgutil`, and `lipo` perform profile and artifact verification. Windows can execute the regression tests and validate syntax, but cannot produce or validate a signed MAS installer or contact Apple without the maintainer's secrets.

The app currently stores recent paths without security-scoped bookmarks. This delivery work does not establish persistent sandbox access. A Store-channel runtime test covering opening a folder, atomic saves, settings, and relaunch is required before public review; failures need a separate app-behavior specification rather than broad filesystem entitlements.

## Review corrections

Apple's [TN3125, Entitlements on macOS](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles#Entitlements-on-macOS) documents that App Sandbox entitlements do not require provisioning-profile authorization. Profile validation must accept an absent sandbox key; the signed app's sandbox and user-selected read/write entitlements are still required and checked directly.

The [`codesign(1)` manual](https://keith.github.io/xcode-man-pages/codesign.1.html) specifies attached values for options with optional arguments. Certificate extraction uses `--extract-certificates=<prefix>` as one argument, with numbered DER files written by codesign. The regression fake creates the extracted certificate only for that command form, instead of pre-populating a file that could hide an invalid invocation.

## UI launcher

GitHub's [workflow trigger documentation](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow) explicitly permits `workflow_dispatch` events created with `GITHUB_TOKEN` to start another run. A personal access token is unnecessary. The main-only launcher uses the built-in token with job-scoped `actions: write`, dispatches the same workflow at the requested release tag, and forwards the version, build number, and upload choice. Tagged runs skip the launcher, preventing recursion. The actual signing job still runs under the tag ref used by the existing environment rule.

Launcher and build concurrency groups differ so a launcher cannot hold the group needed by its tagged child. The launcher records only dispatch success; signing and upload results belong to the separate build run. Local tests stub the GitHub CLI, exercise the actual launcher shell, and check its arguments without creating a run or using real credentials.

## Installed profile permissions (2026-10-26)

Run 40249982258 attempt 2 successfully imported the updated signing exports, signed and verified the universal package, and retained artifact `macos-app-store-13-2`. Apple's package validation then rejected it with error 90255. Streaming inspection of the artifact's gzip/odc-cpio installer payload covered 813 entries. The only entries lacking non-root read access were `markdownmeister.app/Contents/embedded.provisionprofile` and its `._embedded.provisionprofile` AppleDouble sidecar; both had UID 0, GID 0, and mode 0600.

The installed `@electron/osx-sign/dist/cjs/util-provisioning-profiles.js` uses `fs-extra.copy` to embed the selected profile, preserving the source mode. The preparation helper created every credential file with mode 0600. Keep that private original for validation, and create a byte-identical `store-signing.provisionprofile` copy with mode 0644 inside the same mode-0700 credential directory for embedding. The distributable profile contains no private signing key and is already shipped inside the app. Keep the P12 and P8 files at 0600.

Add a verification-only permission scan of the signed app: regular files need other-read, executable files also need other-execute, and directories need other-read and other-execute. Ignore symlink mode bits because framework links refer to separately scanned bundle entries. Reject bad modes without changing the signed app or using a blanket recursive chmod.

## Verified Store credential export format (2026-10-26)

The Store exports used for the successful import and upload were created with `-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1`, matching the working Developer ID export. Local OpenSSL checks verified their passwords and unchanged certificate/key identities before the existing Store secrets were updated. The Windows installer-export example now uses those verified algorithms. No credential contents or passwords are part of the repository change.
