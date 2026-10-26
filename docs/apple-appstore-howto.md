# Mac App Store Delivery

This guide covers building and uploading MarkdownMeister through the **Build and upload Mac App Store package** GitHub Actions workflow. The workflow creates a signed universal `.pkg` for Intel and Apple silicon and can upload it to App Store Connect. Product metadata, testing, App Review submission, and release remain manual.

## 1. Create the App Store Connect App

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/) with the Apple Developer Program account.
2. Create a new macOS app record before configuring repository credentials.
3. Use the registered bundle identifier `dev.yetanotherchris.markdownmeister`. The Store packaging configuration uses this identifier. The direct-download configuration currently uses a separate identifier.
4. Complete the app name, primary language, SKU, user-access setting, and any other required initial fields.
5. Record the App Store Connect app record and confirm the product is visible in App Store Connect before continuing.

Do not create a second app record with a different bundle identifier. App Store Connect treats that as a different product and uploaded builds cannot be reassigned.

## 2. Prepare Apple Signing Material

Prepare these existing or newly created credentials:

1. An **Apple Distribution** certificate (also called Mac App Distribution or 3rd Party Mac Developer Application). Export the certificate with its private key as a password-protected `.p12`.
2. A **Mac Installer Distribution** certificate (the downloaded certificate's name may begin with 3rd Party Mac Developer Installer). Export it with its private key as a separate password-protected `.p12`.
3. A **Mac App Store distribution provisioning profile** for `dev.yetanotherchris.markdownmeister`, selecting the app distribution certificate. Download the `.provisionprofile` file. A development or device-bound profile is not suitable for upload.
4. Your existing **App Store Connect Team API key**, its Key ID, and its Issuer ID. Reuse the key used for notarization if its role allows uploading builds to this app. Do not create another key just for this workflow.

Certificates and profiles are managed under [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list). API keys are under [App Store Connect → Users and Access → Integrations](https://appstoreconnect.apple.com/access/integrations/api).

The `.csr` is the request you upload to Apple when creating a certificate. Apple returns a `.cer`; the workflow needs a `.p12` containing that certificate and the private key that generated the CSR. On a Mac, use Keychain Access to export both. On Windows, use the OpenSSL conversion and export procedure in the direct-download section below with the Store certificate and its matching private key. For the installer certificate, use its own output filenames so you do not overwrite the existing Developer ID export.

Store the `.p12`, provisioning profile, and `.p8` outside the repository. They are credentials, not project assets.

## 3. Configure the Protected GitHub Environment

Use the existing GitHub Actions deployment environment named `macos-signing`, or create it if this is the first signing setup. Store signing and direct-download signing use different certificates but share this environment and the existing upload API key.

Deployment protection rules are optional for this personal project. If you choose to require approval, add yourself as the reviewer and leave **Prevent self-review** unchecked so you can approve runs you trigger. Add these environment secrets:

- `MACOS_APP_STORE_CERTIFICATE_P12_BASE64`: single-line base64 encoding of the Apple Distribution `.p12`.
- `MACOS_APP_STORE_CERTIFICATE_PASSWORD`: password used to export the `.p12`.
- `MACOS_APP_STORE_INSTALLER_P12_BASE64`: single-line base64 encoding of the Mac Installer Distribution `.p12`.
- `MACOS_APP_STORE_INSTALLER_PASSWORD`: password used to export the installer `.p12`.
- `MACOS_APP_STORE_PROVISIONING_PROFILE_BASE64`: single-line base64 encoding of the provisioning profile.
- `APPLE_API_KEY_P8_BASE64`: single-line base64 encoding of the existing App Store Connect API key.
- `APPLE_API_KEY_ID`: the existing API key identifier.
- `APPLE_API_ISSUER`: the existing API key issuer identifier.

Use environment secrets so the credentials are scoped to jobs that use this environment. Approval is required only if you configure a reviewer rule. If deployment branches and tags are restricted, allow **tags matching `v*`**. The UI launcher on `main` does not use this environment or Store credentials. The tagged build rejects invalid release versions and requested/tagged version mismatches before entering the credential-bearing job; `main` does not need deployment access.

If `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` already exist in `macos-signing` for notarization, reuse them. No duplicate secrets or new API key are needed, provided the existing key's role permits uploading builds to this app. The workflow maps these secret names to the delivery helper's internal environment variables.

On Windows, encode each file with PowerShell, then paste the clipboard contents into the corresponding GitHub secret:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\private\store-installer.p12')) | Set-Clipboard
```

Repeat for the app `.p12`, provisioning profile, and existing `.p8` with their actual paths. Passwords, Key ID, and Issuer ID are plain secret values, not base64 files.

## 4. Build and Upload

After the workflow is merged into `main`, create a release tag from a commit containing the UI launcher and version-input changes. The tag must be named `v<version>` (for example, `v1.8.62`). The tag supplies the packaged app version, matching the regular release workflow; `package.json` in that tagged commit may still have the previous version. Tags created before this change still contain the old workflow interface; create the next versioned release tag rather than moving an existing release tag.

1. In GitHub, open **Actions → Build and upload Mac App Store package → Run workflow**.
2. Leave **Use workflow from** set to **main**. Enter **Version** without the `v` prefix, such as `1.8.62`. The corresponding `v1.8.62` tag must already exist.
3. Leave the build number blank to use the workflow run number, or supply an integer from 1 to 9999. Use a higher number than previous uploads for the same product version. Re-running a workflow keeps its run number, so a new dispatch with a higher number is needed if Apple already received the previous build.
4. Leave **Upload the verified package to App Store Connect** selected to validate and upload. Clear it for a build-only run.
5. Click **Run workflow**. The short **launcher** run validates the request and starts a separate **build** run at `v1.8.62`, forwarding your version, build-number override, and upload selection. The launcher summary links back to the workflow page. A successful launcher means only that the tagged build was requested, not that packaging or upload has finished.
6. Follow the **build** run for the actual macOS packaging and upload result. It builds that tagged commit, packages it as version `1.8.62`, and verifies that version in the signed app. Download the signed universal `.pkg` from that run's artifact if needed. The artifact is retained for 14 days and is uploaded before the Apple upload step so it remains available if Apple rejects the upload.

The launcher uses the built-in repository token with `actions: write` permission scoped to its job so it can dispatch the tagged build. It has no signing environment or Store credentials. Tagged build jobs retain read-only repository permissions. Launcher and build runs use separate concurrency groups, so the launcher does not wait for its own child build.

GitHub CLI remains optional. To start the tagged build directly, provide both the tag and its matching version input:

```powershell
gh workflow run build-macos-store.yml --ref v1.8.62 -f version=1.8.62 -f upload=true
```

Creating a `v*` tag does not automatically run Store delivery. It remains a separate manual action from the direct-download release workflow.

The workflow checks the profile's expiry and identifier, the embedded profile, app certificate authorization, both CPU architectures, version/build number, sandbox permissions, and installer signing team. A failure stops delivery. An accepted upload only means Apple has received the build; processing can still reject it later. Check App Store Connect and Apple's processing email before proceeding.

The profile used for embedding is a byte-identical mode-0644 copy inside the private temporary credential directory. This makes the installed profile readable by non-root users before the app is signed, avoiding Apple's error 90255. The original profile, signing exports, and API private key retain mode 0600. Final app verification rejects unreadable files or unsearchable directories before upload. A tag created before this fix retains the old packaging code; after merging a permissions fix, create a new release tag containing it instead of re-running an old tagged build.

The workflow uses Xcode's `altool` to validate and upload with API-key authentication. It does not submit the app for review or release it. Temporary certificates, private keys, and profile files are removed after the run; they are not included as separate workflow artifacts.

## 5. Test, Review, and Release in App Store Connect

After the automated workflow uploads a package, wait for App Store Connect processing to finish. Then complete the required metadata, screenshots, privacy information, age rating, pricing, availability, and export-compliance answers. Select the processed build and submit it for Apple's review.

The workflow must not submit for review or release the app automatically. Those are maintainer decisions in App Store Connect.

## Notes

- The Mac App Store package is sandboxed. User-selected folder access must be explicitly granted by the package's entitlements.
- A Store build signed with Apple Distribution is not expected to run directly outside the Mac App Store. Test a development-signed build on a registered Mac instead.
- Before submitting for public review, test the Store build through TestFlight (or a separately development-signed MAS build). Cover opening a folder, editing and atomic saving, settings persistence, and access after relaunch. The current app does not persist security-scoped bookmarks for recent paths; package verification does not establish that reopening those paths will work after relaunch. Any runtime fixes need their own behavior specification and tests.
- The existing direct-download macOS artifacts are a separate distribution channel.

## Windows: Configure Signing for Direct macOS Downloads

These steps prepare signing and notarization credentials from Windows for the DMG and ZIP downloads on GitHub Releases. They use a **Developer ID Application** certificate in the `macos-signing` GitHub environment. Store delivery uses separate app and installer distribution certificates in that same environment. Creating these credentials does not require using a Mac or installing personal credentials on a work machine. The build, signing, notarization, and disk-image checks run on GitHub's macOS runners.

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

No deployment protection rules are required for this personal project. You can leave **Required reviewers** unset and deployment branches and tags unrestricted. The release workflow checks version-tag syntax and reachability from `main`. If you choose to require your own approval, add yourself under **Required reviewers** and leave **Prevent self-review** unchecked.

References: [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/), [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/), and [GitHub environment configuration](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Windows: Export the Mac App Store Installer Certificate

Use this section after downloading a **Mac Installer Distribution** certificate from Apple. It prepares the installer signing credential for the Store workflow described above. The example assumes the certificate is named `mac_installer.cer` and was issued using `developer-id.csr`, whose matching private key is `developer-id.key`. The CSR's filename does not determine the certificate type; select Mac Installer Distribution in Apple's portal when creating the certificate.

A `.cer` contains the public certificate. A `.p12` bundles that certificate with its matching private key, protected by an export password. Because `.p12` files are binary, the script also writes a single-line base64 text file suitable for a GitHub Actions secret. Base64 is encoding, not encryption; keep both output files private and outside the repository.

### 1. Save the Conversion Script

Save the following as `Convert-MacInstallerToP12.ps1` in the same private directory as `mac_installer.cer` and `developer-id.key`. OpenSSL must be available in PowerShell. The script uses its own directory to locate the inputs and refuses to overwrite either output file.

```powershell
$ErrorActionPreference = 'Stop'

$certificatePath = Join-Path $PSScriptRoot 'mac_installer.cer'
$privateKeyPath = Join-Path $PSScriptRoot 'developer-id.key'
$outputPath = Join-Path $PSScriptRoot 'mac_installer.p12'
$base64Path = Join-Path $PSScriptRoot 'mac_installer.p12.base64.txt'

$openssl = Get-Command openssl -CommandType Application -ErrorAction Stop

foreach ($path in @($certificatePath, $privateKeyPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file not found: $path"
    }
}

if (Test-Path -LiteralPath $outputPath) {
    throw "Output already exists. Move or rename it before running again: $outputPath"
}

if (Test-Path -LiteralPath $base64Path) {
    throw "Output already exists. Move or rename it before running again: $base64Path"
}

$temporaryCertificate = [System.IO.Path]::GetTempFileName()
$exportStarted = $false
$exportSucceeded = $false

try {
    & $openssl.Source x509 -inform DER -in $certificatePath -out $temporaryCertificate
    if ($LASTEXITCODE -ne 0) {
        throw 'OpenSSL could not read the installer certificate.'
    }

    Write-Host 'OpenSSL will ask for the existing developer-id.key password.'
    Write-Host 'Then choose and confirm an export password for mac_installer.p12.'
    Write-Host 'Password input is hidden. Keep the export password for GitHub Actions.'
    Write-Host ''

    $exportStarted = $true
    & $openssl.Source pkcs12 -export `
        -inkey $privateKeyPath `
        -in $temporaryCertificate `
        -out $outputPath `
        -keypbe AES-256-CBC `
        -certpbe AES-256-CBC `
        -macalg SHA256

    if ($LASTEXITCODE -ne 0) {
        throw 'OpenSSL could not export the P12. Check the passwords and try again.'
    }

    $exportSucceeded = $true
    $base64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($outputPath))
    [System.IO.File]::WriteAllText($base64Path, $base64, [System.Text.Encoding]::ASCII)

    Write-Host ''
    Write-Host "Created: $outputPath"
    Write-Host "Created: $base64Path"
    Write-Host 'Copy the entire text file into the MACOS_APP_STORE_INSTALLER_P12_BASE64 GitHub secret.'
    Write-Host 'Put the export password in MACOS_APP_STORE_INSTALLER_PASSWORD.'
    Write-Host 'Keep both files private. Do not commit them to a repository.'
}
finally {
    Remove-Item -LiteralPath $temporaryCertificate -Force

    # A failed export may leave an incomplete credential file.
    if ($exportStarted -and -not $exportSucceeded -and (Test-Path -LiteralPath $outputPath)) {
        Remove-Item -LiteralPath $outputPath -Force
    }
}
```

### 2. Run the Script

Run it from PowerShell, substituting your private directory if different:

```powershell
& 'C:\Users\chris\Downloads\temp\apple-certs\Convert-MacInstallerToP12.ps1'
```

Enter the existing `developer-id.key` password when OpenSSL asks for the input key's passphrase. Then choose and confirm an export password for the new `.p12`. These passwords are entered locally and are not written into the script or base64 file.

The script creates `mac_installer.p12` and `mac_installer.p12.base64.txt` beside the script. Keep the export password for the GitHub secret below. If an output already exists, move or rename it before running the script again.

### 3. Add the Installer Secrets to GitHub

Open the repository's **Settings → Environments → `macos-signing`**, creating that environment if necessary. Add these two environment secrets:

| Secret | Value |
| --- | --- |
| `MACOS_APP_STORE_INSTALLER_P12_BASE64` | The entire contents of `mac_installer.p12.base64.txt`. |
| `MACOS_APP_STORE_INSTALLER_PASSWORD` | The `.p12` export password chosen when running the script. |

You can open the text file and copy its contents, or copy it directly to the clipboard:

```powershell
Get-Content -LiteralPath 'C:\Users\chris\Downloads\temp\apple-certs\mac_installer.p12.base64.txt' -Raw |
    Set-Clipboard
```

The workflow decodes the base64 secret back into a binary `.p12` on the macOS runner and uses the export password to import it for signing. The installer secrets are in addition to the app distribution certificate, provisioning profile, and API-key secrets listed in section 3 above.
