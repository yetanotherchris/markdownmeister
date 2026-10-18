# Ubuntu Snap Store Delivery

This guide is for the maintainer who publishes MarkdownMeister through the [Ubuntu Snap Store](https://snapcraft.io/markdownmeister). The account, snap registration, repository credential, and store listing have already been set up. The first two sections record that setup for future maintenance; subsequent releases start at step 3.

The Snap Store is the project's only supported Linux store. **Flathub is not supported**, and the project does not publish or maintain a Flatpak package. Flathub's [Generative AI policy](https://docs.flathub.org/docs/for-app-authors/requirements#generative-ai-policy) was considered when declining that channel. Direct-download `.deb` and AppImage packages are separate distribution routes; see the [installation instructions](../README.md#linux-debian-ubuntu-mint).

## 1. Register the Snap and Complete the Listing

1. Sign in to the [Snap Store dashboard](https://dashboard.snapcraft.io/) with the publisher's Ubuntu One account and accept the developer terms.
2. Register `markdownmeister` with `snapcraft register markdownmeister`. This name is already registered for the project; use the existing product record rather than creating another listing.
3. Complete the listing with the app name, summary, description, icon, screenshots, MIT licence, [homepage](https://yetanotherchris.github.io/markdownmeister/), and [support link](https://github.com/yetanotherchris/markdownmeister/issues).
4. Confirm the listing points to the `stable` channel. The package is x86-64 only and uses strict confinement.

The `snap` block in `electron-builder.yml` contains the package summary and description. Maintain the public listing separately in the dashboard.

## 2. Configure the GitHub Actions Credential

On a machine with Snapcraft installed, export a publisher credential for this snap:

```sh
snapcraft export-login --snaps=markdownmeister --channels=stable -
```

1. In the GitHub repository, open Settings, Secrets and variables, Actions.
2. Store the exported credential as the repository secret `SNAPCRAFT_STORE_CREDENTIALS`. Use the exported value directly, without adding another base64 encoding.
3. Keep the credential out of source control and workflow logs. Replace the secret when the credential expires or is revoked.

The existing workflow reads this secret only for publication. Building a candidate does not require it.

## 3. Build a Release Candidate

1. Open GitHub Actions and select **Build Linux store package** (`.github/workflows/build-linux-store.yml`).
2. Run the workflow from the release tag, for example `v1.8.2`.
3. Set `version` to the same version without `v`, for example `1.8.2`, and leave `publish` disabled.
4. Wait for the build and smoke test to pass, then download `artifacts-linux-x64-snap`. The package inside is `markdownmeister-<version>-linux-x64.snap`.

The workflow checks the version against the tag, builds the app, packages the snap, and verifies its filename. It also installs the snap, checks its declared interfaces, runs it under a virtual display for 30 seconds, and removes it to check for a leftover AppImage desktop entry. These checks do not replace testing the desktop application interactively.

## 4. Verify the Candidate on Ubuntu

On an Ubuntu desktop with snapd, install the downloaded candidate (replace `<version>`):

```sh
sudo snap install --dangerous ./markdownmeister-<version>-linux-x64.snap
snap run markdownmeister
```

1. Open a folder, create and edit a Markdown file, save it, and reopen it. Change a file externally and confirm the app notices the change.
2. Confirm the app reports the release version and that unsaved edits still prompt before closing.
3. Test a workspace in a non-hidden directory under your home folder. If testing removable storage, explicitly connect its interface with `sudo snap connect markdownmeister:removable-media`, then open that workspace.
4. Check the launcher and confirm installing or removing the snap does not remove an existing AppImage launcher.

Strict confinement limits accessible locations. The app opens folders through its own Open Folder control; it does not install the AppImage's folder Open With entry. Remove the local candidate with `sudo snap remove markdownmeister` before testing a fresh store installation.

## 5. Publish to Stable and Verify Delivery

1. Run **Build Linux store package** again from the same release tag, with the matching `version` and `publish` enabled. This rebuilds the tagged source and uploads it to `stable` using the repository credential.
2. Alternatively, upload the exact candidate you verified from a logged-in Snapcraft session: `snapcraft upload --release=stable markdownmeister-<version>-linux-x64.snap`.
3. Check the dashboard for processing or review issues and confirm the revision is released to `stable`.
4. On Ubuntu, run `sudo snap install markdownmeister`, launch the app from the application menu, and confirm the version and folder editing work.
5. For subsequent releases, test an upgrade from the previous store revision with `sudo snap refresh markdownmeister`, then launch and verify it again.

An upload alone does not confirm delivery. The stable revision must install and launch successfully. Repeat steps 3 to 5 for each release.

## Troubleshooting

- **Version rejected:** use a three-part version matching the selected release tag, without the leading `v`.
- **Publication refused:** select a release tag and check that `SNAPCRAFT_STORE_CREDENTIALS` is present, valid, and belongs to the publisher of `markdownmeister`.
- **Upload accepted but no update available:** check review status and the stable revision in the dashboard.
- **Folder inaccessible:** use a non-hidden folder under your home directory, or connect `removable-media` for removable storage. Strict confinement does not grant access to every filesystem location.
- **Smoke test fails:** inspect the workflow's snap launch log and interface connections before publishing again.
