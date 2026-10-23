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

Configure it to allow release tags matching `v*`; the submission workflow must separately verify that the tag is reachable from `main`. Add yourself as the required reviewer and leave **Prevent self-review** unchecked so you can approve runs you trigger. Add the following environment secrets when Spec 070's submission workflow is implemented:

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

## Windows: Configure Signing for Direct macOS Downloads

These steps prepare signing and notarization credentials from Windows for the DMG and ZIP downloads on GitHub Releases. They use a **Developer ID Application** certificate and the `macos-signing` GitHub environment, rather than the Apple Distribution certificate and `macos-app-store` environment described above. Creating these credentials does not require using a Mac or installing personal credentials on a work machine. The build, signing, notarization, and disk-image checks run on GitHub's macOS runners.

You need an active Apple Developer Program membership and OpenSSL installed on Windows, with `openssl` available in PowerShell. Run the commands in a private directory outside the repository. Keep the private key, `.p12`, and `.p8` files securely backed up outside the repository.

### 1. Generate a Private Key and Certificate Request

In PowerShell:

```powershell
openssl genpkey -algorithm RSA -aes-256-cbc -pkeyopt rsa_keygen_bits:2048 -out developer-id.key
openssl req -new -sha256 -key developer-id.key -out developer-id.csr
```

The first command asks you to choose a password protecting the private key. The second asks for certificate-request details; use your name and email. Leave the optional challenge password blank. The private-key password is separate from the `.p12` export password chosen below.

### 2. Get the Developer ID Application Certificate from Apple

1. Sign in to [Apple Developer, Certificates](https://developer.apple.com/account/resources/certificates/list) as the Account Holder.
2. Click **+** and select **Developer ID Application**.
3. Upload `developer-id.csr`.
4. Download the resulting `.cer` file into the private directory containing `developer-id.key`.

The commands below assume the downloaded certificate is named `developerID_application.cer`. Adjust that filename if Apple's download has a different name.

### 3. Export the Certificate and Private Key as a `.p12`

Convert Apple's certificate to PEM, then export it together with the private key. The explicit PKCS#12 algorithms keep the export compatible with macOS keychain import:

```powershell
openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem

openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem `
    -out MarkdownMeister-signing.p12 `
    -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

Enter the private-key password when prompted. Then choose an export password. The export password becomes `MACOS_CERTIFICATE_PASSWORD`.

Encode the `.p12` and copy the result to the Windows clipboard:

```powershell
[Convert]::ToBase64String(
    [IO.File]::ReadAllBytes((Resolve-Path ".\MarkdownMeister-signing.p12").Path)
) | Set-Clipboard
```

Paste the clipboard contents into the `MACOS_CERTIFICATE_P12_BASE64` GitHub environment secret.

Display the certificate identity:

```powershell
openssl x509 -in developer-id.pem -noout -subject -nameopt multiline
```

Use the complete `commonName` value, such as `Developer ID Application: Your Name (TEAMID)`, for `MACOS_SIGNING_IDENTITY`. Do not include the `commonName =` label or surrounding quotation marks.

### 4. Create an App Store Connect Team API Key

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Open **Users and Access → Integrations → App Store Connect API**.
3. If shown, click **Request Access** first.
4. Open **Team Keys** and click **Generate API Key** or **+**.
5. Name it `MarkdownMeister CI` and choose **App Manager** access.
6. Generate the key and download its `.p8` file. Apple only lets you download the private key once.
7. Record the key's **Key ID** and the **Issuer ID** shown on the Team Keys page.

Use a team key for the current workflow, which expects an issuer ID. Encode the downloaded `.p8`, substituting its actual filename:

```powershell
[Convert]::ToBase64String(
    [IO.File]::ReadAllBytes((Resolve-Path ".\AuthKey_YOURKEYID.p8").Path)
) | Set-Clipboard
```

Paste the clipboard contents into `APPLE_API_KEY_P8_BASE64`. Set `APPLE_API_KEY_ID` to the Key ID and `APPLE_API_ISSUER` to the Issuer ID.

### 5. Generate the Temporary CI Keychain Password

```powershell
openssl rand -hex 32 | Set-Clipboard
```

Paste the clipboard contents into `MACOS_KEYCHAIN_PASSWORD`. This is a new random password for the temporary keychain on the GitHub runner, not your Windows, Mac, or Apple account password.

### 6. Add the Seven GitHub Environment Secrets

Open the repository's **Settings → Environments → `macos-signing`**, creating that environment if necessary. Add these as **Environment secrets**:

| Secret | Value |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64 encoding of `MarkdownMeister-signing.p12` from step 3. |
| `MACOS_CERTIFICATE_PASSWORD` | The `.p12` export password chosen in step 3. |
| `MACOS_SIGNING_IDENTITY` | The full Developer ID Application certificate common name from step 3. |
| `APPLE_API_KEY_P8_BASE64` | Base64 encoding of the downloaded team API `.p8` file from step 4. |
| `APPLE_API_KEY_ID` | The API key's Key ID from App Store Connect. |
| `APPLE_API_ISSUER` | The Issuer ID from App Store Connect's Team Keys page. |
| `MACOS_KEYCHAIN_PASSWORD` | The random password generated in step 5. |

Add yourself under **Required reviewers** and leave **Prevent self-review** unchecked. You can then approve release runs that you trigger yourself. If restricting deployment refs, allow **tags matching `v*`**, not just the `main` branch; the release workflow separately checks tag reachability from `main`.

References: [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/), [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/), and [GitHub environment configuration](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
