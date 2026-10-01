# Linux store release procedure

Spec 064 (FR-001, FR-002, FR-006, FR-008, FR-011, FR-012, FR-014, FR-015, FR-016, FR-018, FR-019). How the Snap Store and Flathub builds of MarkdownMeister are produced, verified, and submitted, and which checks remain manual. The automation ends at a verified `.snap`; Snap Store upload, Flathub's manifest, and both stores' reviews remain human steps.

For the Windows Store channel, see `store-release.md`.

## What ships

The Snap Store package is the same application as the direct-download AppImage, packed by electron-builder from its base core20 Electron snap template with strict confinement. The snap name is `markdownmeister`, taken from `executableName` lowercased. No application code changes: the snap is a packaging target, selected only by the Linux store workflow.

The Flatpak is built from a manifest that lives in the maintainer's Flathub repository, not in this repository. Flathub's published policy forbids AI-generated or AI-assisted manifest content and forbids an AI agent from opening or automating the submission, so the manifest and the submission are maintainer-authored (spec FR-016). This repository supplies the application and its icon; it does not contain the manifest.

## Product identity

These identifiers are public: they appear in the shipped snap metadata and in the store listings.

| Channel | Field | Value |
| --- | --- | --- |
| Snap Store | Snap name | `markdownmeister` |
| Snap Store | Channel | `stable` |
| Snap Store | Confinement | `strict` |
| Flathub | Application ID | `io.github.yetanotherchris.MarkdownMeister` |
| Flathub | Architecture | x64 only |

## Snap Store

### One-time setup

1. Sign in to the Snap Store with an Ubuntu One account and accept the developer terms.
2. Register the name if it is not already held: `snapcraft register markdownmeister`. A name already registered to another publisher cannot be used. The snap name is derived from `executableName` lowercased and is shared with the AppImage, so a new name would have to change both the electron-builder config and `SNAP_NAME` in `scripts/linux-store-submission.mjs` together.
3. Export a credential and store it as a repository secret named `SNAPCRAFT_STORE_CREDENTIALS` (Settings, Secrets and variables, Actions, Secrets): `snapcraft export-login - | base64 -w0`. The credential is read from the environment by the workflow's publish step and is never written into the repository (FR-012).
4. Fill the store listing: name, summary, description, icon, screenshots (at least one per supported desktop), licence (MIT), homepage, and a support link (the GitHub Issues page). The summary and description in `electron-builder.yml`'s `snap` block are the snap's own metadata; the listing text is entered in the store dashboard.

### Build the submission candidate

Dispatch **Build Linux store package** (`.github/workflows/build-linux-store.yml`) from the **release tag**:

- `version`: the release version without the leading `v`, for example `1.7.0`. It must equal the tag; the workflow asserts this when run against a tag.
- `publish`: leave off. The build validates the version, packages `--linux snap --x64`, verifies the produced `.snap` is named for that version, and uploads it as an artifact.

The snap can only be built on Linux. Locally, on a Linux host:

```sh
npm ci
npm run build
npx electron-builder --linux snap --x64 --publish never -c.extraMetadata.version=1.7.0
```

electron-builder downloads its base core20 Electron snap template and `mksquashfs` toolset, so no `snapcraft` install is needed to produce the `.snap`. The artifact is `dist/markdownmeister-<version>-linux-x64.snap`.

### Mandatory pre-submission verification

CI verifies the version and artifact name only. Before publishing, install the built snap on a real machine and run the sandbox matrix that CI cannot:

1. Install the candidate: `snap install --dangerous ./dist/markdownmeister-<version>-linux-x64.snap`.
2. Open a user-chosen folder, enumerate it, create a file, change a file from outside the app, edit it, save it, and reopen the workspace. Every step must behave as in the AppImage (FR-006).
3. Hand a folder to the app from the file manager. The path is untrusted and is validated in the main process; a path outside the workspace is refused (FR-007).
4. Confirm the app cannot read or write user documents outside the workspace. Under strict confinement the `home` interface grants non-hidden files under `$HOME`. A folder outside `$HOME` (on removable media) is reached by the user connecting the declared `removable-media` interface (`sudo snap connect markdownmeister:removable-media`); it is declared but not auto-connected, so the grant stays the user's explicit choice (FR-008). Blanket home access is deliberately not requested.
5. Review the declared interfaces against actual use and remove any proven unused (FR-019). The declared set is `desktop`, `desktop-legacy`, `home`, `x11`, `wayland`, `unity7`, `browser-support`, `gsettings`, `opengl`; `browser-support` is Chromium's sandbox, and `wayland`/`x11` are the display backends.
6. Confirm the AppImage's own desktop entry still appears and works beside the snap, and that removing the snap removes only the snap's entry (FR-017).

### Folder Open With (FR-009)

The AppImage registers a folder entry by writing `~/.local/share/applications/markdownmeister.desktop` at launch. A strictly-confined snap cannot do this: the `home` interface excludes hidden paths, so `~/.local` is not writable, and the app's self-write stays AppImage-only. The snap therefore relies on snapd's desktop integration for its launcher, and the folder Open With entry falls under FR-009's "where the desktop does not support it" case: the app still opens folders through its own Open Folder control, and no broken entry is left behind. Verify this on the real machine (step 2 above covers opening a folder). The Flathub manifest can provide the entry instead, by adding `MimeType=inode/directory;` to its own `.desktop` file (FR-009).

### Publish

1. Dispatch the workflow again from the same tag with `publish` enabled, or upload the verified artifact directly: `snapcraft upload --release=stable dist/markdownmeister-<version>-linux-x64.snap`. The publish step refuses to run without the credential.
2. On a real Ubuntu machine, `sudo snap install markdownmeister`, launch it, and confirm a later revision refresh installs and launches. A successful upload is not delivery; the published stable revision must install and launch (FR-018).

### Updates

For each release, build the candidate from the new tag, repeat the sandbox matrix, publish to `stable`, and re-verify the install and the upgrade from the previous revision. A snap build or review failure leaves the direct-download release and the Flathub channel untouched (FR-013).

## Flathub (maintainer-authored)

The maintainer authors the manifest and opens the submission. Use this list as the requirements; do not generate the manifest with an AI tool (FR-016).

- **Application ID**: `io.github.yetanotherchris.MarkdownMeister`, matching the metainfo file name and the `app-id` used throughout. Flathub accepts the `io.github.yetanotherchris` namespace because the project is hosted under that GitHub account; no custom-domain verification is needed (FR-015).
- **Architecture**: x64 only, declared in the Flathub repository's `flathub.json` as `"only-arches": ["x86_64"]`.
- **Build from source, offline**: the manifest lists `sources` for the application and every dependency, and the build runs without network access (FR-011).
- **Runtime and base**: a current `org.freedesktop.Platform` runtime plus the Electron base app, or Electron built from source in the manifest. Choose the versions the manifest's build actually uses.
- **Permissions**: the minimum. Use `--filesystem=home` only if the document portal cannot provide the folder access the app needs; the app opens folders itself so the manifest must grant read/write to the user's chosen workspace without granting the whole home directory needlessly (FR-008). Add `--socket=x11`, `--socket=wayland`, `--device=dri` for display and GPU, and `--share=network` only if a network call exists.
- **Metadata**: a metainfo file (`io.github.yetanotherchris.MarkdownMeister.metainfo.xml`) with the app name, summary, description, licence, homepage, and at least one screenshot; a `.desktop` file; icons named for the application ID at several sizes; and the MIT licence installed as `copyright` (FR-003, FR-011).
- **Version**: the Flatpak version matches the release and is reported in the app (FR-004).
- **Lint**: `flatpak-builder-lint manifest <manifest>` and the appstream/metainfo lint pass before submission (FR-011).
- **Local gate**: build and launch the Flatpak locally before opening the submission (FR-011).

Then open the submission pull request against the Flathub repository, with maintainer-written text, and answer review personally (FR-016). If any application material was AI-generated, it must be disclosed to Flathub as its policy requires (FR-016).

## Channel identity

The three Linux channels never share a desktop entry (FR-017):

- The AppImage writes `~/.local/share/applications/markdownmeister.desktop` at launch, and only when `process.env.APPIMAGE` is set; `--remove-folder-action` removes it.
- The snap's desktop entry is installed by snapd under its snap-qualified name. The app never writes the AppImage entry when running as a snap.
- The Flatpak owns a desktop entry named for its application ID.

Installing or removing one channel leaves the others' entries and installed state intact.

## Failure triage

- Workflow fails on the version: the input must be three-part and equal to the release tag.
- No `.snap` artifact: the template download or `mksquashfs` step failed; re-run the workflow.
- Publish refused: `SNAPCRAFT_STORE_CREDENTIALS` is unset, or the snap name is not registered to the account. The credential must stay in Actions secrets.
- The app cannot open a folder outside `$HOME`: expected under strict confinement; connect `removable-media` or move the workspace inside `$HOME`.
- A channel's desktop entry disappeared: check the channel-identity rule above; a store build must never write the AppImage entry.
