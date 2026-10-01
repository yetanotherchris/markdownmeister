# Research: Linux Store Distribution (Flathub and Snap Store)

Date: 2026-10-01. Each decision states the choice, the evidence, and the rejected alternatives. electron-builder behaviour was verified against the installed 26.15.3 source in `node_modules/`; platform requirements cite Flathub and Snapcraft documentation.

## D1: The snap is built by electron-builder's core22 template path, so CI needs no `snapcraft` or VM

**Decision**: Configure the legacy `snap` target and let electron-builder use its template path (`useTemplateApp`, the default for x64 when `buildPackages`/`stagePackages` are not customised). The build downloads the prebuilt Electron snap template and packs the stage with `mksquashfs`; it does not run a snapcraft build or a virtual machine on the host.

**Evidence**:

- `SnapTarget` merges the `snapcraft` and legacy `snap` config (`node_modules/app-builder-lib/out/targets/snap/SnapTarget.js:26-27`).
- The legacy core computes `isUseTemplateApp` as `useTemplateApp !== false && arch is x64/armv7l && no custom buildPackages && stagePackages equals the default set` (`coreLegacy.js:57-58`), and `buildWithTemplate` downloads the template then runs `mksquashfs` directly (`coreLegacy.js:242-271`). `buildWithoutTemplate` is the path that needs the snapcraft CLI (`coreLegacy.js:273`).
- The snap name is `packager.executableName.toLowerCase()` (`coreLegacy.js:48`), and `executableName` is `markdownmeister` (`electron-builder.yml`), so the snap is `markdownmeister`. The snap version is `appInfo.version` (`coreLegacy.js:104`), which the workflow overrides with `-c.extraMetadata.version`.

**Alternatives considered**:

- Rejected: *core24 direct-snapcraft build*. It is flagged beta in `SnapOptions.d.ts:43-54,304-314` and runs `snapcraft` with LXD/Multipass, which GitHub's hosted runners support poorly; it is more moving parts than this channel needs.
- Rejected: *remote Launchpad build*. It adds a Launchpad dependency and credentials for the same artifact.

## D2: The snap target is selected on the command line, not added to `linux.target`

**Decision**: Add a `snap` config block but leave `linux.target` as the AppImage only. The workflow runs `electron-builder --linux snap --x64`.

**Evidence**: The direct-download release (`build-release.yml`) runs `npm run dist`, which builds `linux.target`; adding snap there would route every release, every local Windows/macOS build, and the AppImage step through the snap template download. Spec 062 already established this pattern for the Windows Store package by keeping `appx` out of `win.target` and selecting it in `build-store.yml`.

**Alternatives considered**: Rejected: *add snap to `linux.target`*. It would couple the direct-download artifact to the store toolchain (FR-013 forbids one channel failing the other).

## D3: An explicit minimal plug set, with the unused defaults removed

**Decision**: Declare `plugs` explicitly as `desktop`, `desktop-legacy`, `home`, `x11`, `wayland`, `unity7`, `browser-support`, `gsettings`, `opengl`. Do not declare the electron-builder defaults `network`, `audio-playback`, or `pulseaudio`. Leave `removable-media` undeclared and document that the user connects it manually for folders outside the home directory.

**Evidence**:

- electron-builder's default plug list is `desktop`, `desktop-legacy`, `home`, `x11`, `wayland`, `unity7`, `browser-support`, `network`, `gsettings`, `audio-playback`, `pulseaudio`, `opengl` (`coreLegacy.js:37`).
- `home` is what makes folder enumeration, creation, watching, and atomic saves work for any workspace inside `$HOME` (FR-006). `desktop`/`desktop-legacy` are what let `shell.openExternal` and `shell.openPath` reach the desktop's handlers (`src/main/ipc/handlers/build.ts`, `src/main/ipc/handlers/files.ts`). `x11`/`wayland`/`opengl` are the display and GPU interfaces, and `browser-support` is Chromium's own sandbox, required by Electron. `gsettings` reads desktop appearance, and `unity7` keeps launcher/menu integration on Ubuntu.
- A search of `src/` finds no `fetch`, `http(s)`, or updater call in the application (the release-version refresh is site JavaScript, not app code), so `network` is unused; the app plays no audio, so `audio-playback`/`pulseaudio` are unused. FR-019 forbids unused interfaces.

**Alternatives considered**:

- Rejected: *keep the full default set*. It declares three interfaces the app never uses, contradicting FR-019.
- Rejected: *also connect `removable-media` automatically*. It is not auto-connected for store snaps and would grant broad access the user did not choose; the platform's normal mechanism is a manual `snap connect`, documented in `docs/linux-store-release.md`.

## D4: Flathub is documented, not authored

**Decision**: Do not commit a Flatpak manifest. Document, in `docs/linux-store-release.md`, the application ID `io.github.yetanotherchris.MarkdownMeister`, the x64 restriction, the runtime/base expectations, the `finish-args` the manifest must declare (minimum filesystem access, no blanket home), the required metainfo/desktop/icon/licence metadata, the offline-source and lint requirements, the local install-and-launch gate, and the maintainer-run submission.

**Evidence**: Spec FR-016 records Flathub's policy: no AI-generated or AI-assisted manifest content, and no AI agent may open or automate the submission or write its text. The manifest therefore has to be maintainer-authored, exactly as spec 062 left Partner Center as a maintainer step.

**Alternatives considered**: Rejected: *scaffold a manifest for the maintainer to edit*. FR-016 forbids AI-assisted manifest content, so even a scaffold would violate it.

## D5: Version comes from a dispatched input, is checked against the release tag, and publishing is credential-gated and opt-in

**Decision**: `build-linux-store.yml` takes a required `version` input and a boolean `publish` input defaulting to false. `scripts/linux-store-submission.mjs` asserts the version is a three-part semver, that it equals the release tag when dispatched on a tag, that the produced `.snap` is named for that version, and that publishing is only attempted when `SNAPCRAFT_STORE_CREDENTIALS` is present.

**Evidence**: The release workflow takes its version from the tag and syncs `package.json` afterwards (`build-release.yml`), so a snap built from a branch could otherwise carry a stale version. Spec 062 established the same dispatch-input pattern (its research D3). The credential check is the machine form of FR-012's "keep its credentials out of the repository": the secret is read from the environment and never written to disk.

**Alternatives considered**:

- Rejected: *derive the version from `package.json` only*. It is the defect spec 062 FR-017 called out for the Store package; the same reasoning applies here.
- Rejected: *publish automatically on every build*. FR-018 says a store version is not delivered until the published revision is verified, so uploading is a deliberate, separately-verified act.

## D6: Channel identity stays distinct, and the AppImage entry stays AppImage-only

**Decision**: Keep `src/main/linuxDesktopEntry.ts` gated on `process.env.APPIMAGE` (unchanged). Rely on the platform identities: the AppImage owns `~/.local/share/applications/markdownmeister.desktop`, the snap's desktop file is installed by snapd under its snap-qualified name, and a Flatpak owns a `<application-id>.desktop`. A test asserts the AppImage entry name and the snap name differ and that the self-write remains APPIMAGE-gated.

**Evidence**: `src/main/index.ts:108` returns early unless `process.env.APPIMAGE` is set, so a snap or Flatpak launch never writes or removes the AppImage's entry; snapd prefixes a snap's desktop file, and the Flatpak target names its desktop file `${appId}.desktop` (`FlatpakTarget.js:57`). This is what FR-017 requires: installing or removing a store build cannot mask the AppImage entry, and uninstalling a channel removes only its own.

**Alternatives considered**: Rejected: *rename the AppImage entry to a reverse-domain name*. It gains nothing (the identities are already distinct) and would orphan every existing AppImage user's entry.

## References

- electron-builder source: `node_modules/app-builder-lib/out/targets/snap/{SnapTarget,coreLegacy,snapcraftBuilder}.js`, `out/options/SnapOptions.d.ts`, `out/targets/FlatpakTarget.js`.
- Flathub submission and AI policy, application ID and requirements pages: `docs.flathub.org`.
- Snapcraft interfaces, confinement, and automated review: `snapcraft.io/docs`.
- Spec 062 `research.md` D1–D3 (dispatch-input version gate, CLI target selection).
- Spec 038 `spec.md` and `tests/main/channelIsolation.test.ts` (channel isolation baseline).
