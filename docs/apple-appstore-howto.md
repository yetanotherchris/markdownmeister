# Mac App Store Delivery

This guide is for the maintainer who prepares MarkdownMeister for delivery through the Mac App Store. It covers the tasks that must happen before automated package submission can be enabled. It does not replace App Store Connect's product metadata or Apple review process.

## 1. Create the App Store Connect App

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/) with the Apple Developer Program account.
2. Create a new macOS app record before configuring repository credentials.
3. Use the bundle identifier `com.yetanotherchris.markdownmeister`. It must match the identifier used by the packaged application.
4. Complete the app name, primary language, SKU, user-access setting, and any other required initial fields.
5. Record the App Store Connect app record and confirm the product is visible in App Store Connect before continuing.

Do not create a second app record with a different bundle identifier. App Store Connect treats that as a different product and uploaded builds cannot be reassigned.

## 2. Prepare Apple Signing Material

On a Mac with Xcode installed:

1. Open Xcode, Settings, Accounts, select the Apple Developer team, then Manage Certificates.
2. Create or obtain an **Apple Distribution** certificate. Export its certificate and private key as a password-protected `.p12` file.
3. Create the Mac App Store provisioning profile for `com.yetanotherchris.markdownmeister` and retain the downloaded profile.
4. Create an App Store Connect API key with only the role required to upload builds. Download the `.p8` file when Apple offers it; it cannot be downloaded again later.

Store the `.p12`, provisioning profile, and `.p8` outside the repository. They are credentials, not project assets.

## 3. Configure the Protected GitHub Environment

Create a GitHub Actions deployment environment named `macos-app-store`.

Configure it to allow only releases from `main` tags and require an independent reviewer before it exposes credentials. Add the following environment secrets when Spec 070's submission workflow is implemented:

- `MACOS_APP_STORE_CERTIFICATE_P12_BASE64`: single-line base64 encoding of the Apple Distribution `.p12`.
- `MACOS_APP_STORE_CERTIFICATE_PASSWORD`: password used to export the `.p12`.
- `MACOS_APP_STORE_PROVISIONING_PROFILE_BASE64`: single-line base64 encoding of the provisioning profile.
- `APP_STORE_CONNECT_API_KEY_P8_BASE64`: single-line base64 encoding of the App Store Connect API key.
- `APP_STORE_CONNECT_API_KEY_ID`: the API key identifier.
- `APP_STORE_CONNECT_ISSUER_ID`: the API key issuer identifier.

Use environment secrets rather than repository secrets so an approval is required before a release workflow can access them.

## 4. Review and Release in App Store Connect

After the automated workflow uploads a package, wait for App Store Connect processing to finish. Then complete the required metadata, screenshots, privacy information, age rating, pricing, availability, and export-compliance answers. Select the processed build and submit it for Apple's review.

The workflow must not submit for review or release the app automatically. Those are maintainer decisions in App Store Connect.

## Notes

- The Mac App Store package is sandboxed. User-selected folder access must be explicitly granted by the package's entitlements.
- A Store build signed with Apple Distribution is not expected to run directly outside the Mac App Store. Test a development-signed build on a registered Mac instead.
- The existing direct-download macOS artifacts are a separate distribution channel.
