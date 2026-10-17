# Research: Debian Package Distribution (No Flathub)

Date: 2026-10-17. Each entry states the finding, the evidence, and the implication. electron-builder behaviour was read from the installed source in `node_modules/`; the Debian package format cites `deb(5)` and Debian policy; the Flathub facts cite Flathub's own pages and its submission history.

## D1: A `.deb` is an `ar` archive of two tarballs, not a zip

**Finding**: A Debian package is a Unix `ar` archive containing exactly three members in order:

- `debian-binary`: a plain text file holding the format version, usually `2.0`.
- `control.tar.{gz,xz,zst}`: the package metadata and scripts, including `control` (package name, version, architecture, dependencies, maintainer, description), `md5sums`, and any `preinst`/`postinst`/`prerm`/`postrm`.
- `data.tar.{gz,xz,zst}`: the filesystem tree that gets installed (`/usr/bin`, `/usr/share/applications`, `/usr/share/icons`, and the application itself).

**Evidence**: This is the format defined by Debian's `deb(5)` manual page and Debian policy; the three members and their order are normative. It is deliberately not like the Windows packaging: a `.appx`/`.msix` is an OPC zip containing `AppxManifest.xml` and assets, and an `.rpm` is a lead, signature and header followed by a `cpio` payload. An AppImage is an ELF runtime with a `squashfs` image appended. A `.deb` is the only one of these that is a plain `ar` archive.

**Implication**: A `.deb` is a system package: it is installed into the system (registered with `dpkg`, files under `/usr` or `/opt`) and removed through apt, unlike the AppImage which is a file that is run in place. This is why the user installs it (double-click, or `sudo apt install ./<file>.deb`) and uninstalls it with `sudo apt remove markdownmeister`, and why the desktop entry and dependency handling come for free.

## D2: electron-builder builds the `.deb` through `FpmTarget`, which requires a homepage and a maintainer

**Finding**: electron-builder's Debian target is `FpmTarget`. It forces the Debian artifact name `${name}_${version}_${arch}.${ext}` (with `amd64` for x64), and its `computeFpmMetaInfoOptions` throws unless the project has a homepage and a maintainer (name and email). The current `package.json` has none of `author`, `homepage`, or `repository`.

**Evidence**:

- `node_modules/app-builder-lib/out/targets/FpmTarget.js` sets `nameFormat = "${name}_${version}_${arch}.${ext}"` and `isUseArchIfX64 = true` for the `deb` target, so the artifact is `markdownmeister_<version>_amd64.deb` rather than following `linux.artifactName`.
- The same file's `computeFpmMetaInfoOptions` pushes "Please specify project homepage" when `appInfo.computePackageUrl()` returns null and `authorEmailIsMissed` when there is no maintainer; `appInfo.computePackageUrl()` reads `metadata.homepage`. `package.json` currently has no `homepage` or `author` field.
- Linux-specific `deb` options (`depends`, `category`, `priority`, `maintainer`, `synopsis`, `afterInstall`, `afterRemove`) come from `node_modules/app-builder-lib/out/options/linuxOptions.d.ts`, and `electron-builder.yml` supports a top-level `deb` block.

**Implication**: The change must add a homepage and a maintainer. These can be a `package.json` `homepage` plus an `author` with an email, or an explicit `homepage` and `deb.maintainer` in `electron-builder.yml`. Without them the `.deb` build fails, so they are a hard prerequisite, not decoration.

## D3: No new workflow is required; the existing release workflow publishes the `.deb`

**Finding**: The release workflow already builds Linux on `ubuntu-latest` with `npx electron-builder --linux --x64`, which builds every target in `linux.target`. Adding `deb` there produces the package on the same run. The workflow then needs the `.deb` added to its upload glob and to the `release` job's required-artifact list.

**Evidence**: `.github/workflows/build-release.yml` has a `linux` matrix leg on `ubuntu-latest` running `npx electron-builder --linux --x64 --publish never --config.extraMetadata.version=…`, an `Upload artifacts` step whose `path:` lists `dist/markdownmeister-*.exe`, `*.zip`, `*.dmg`, and `*.AppImage`, and a `release` job whose `Verify required artifact set` step enumerates the expected files. The `deb` target is absent from `linux.target` today, and no `dist/markdownmeister_*.deb` is uploaded or checked.

**Implication**: This feature edits the existing workflow (package step unchanged; upload glob and required-artifact list extended) and adds no `build-deb.yml`. A separate workflow would duplicate the version gate, the `npm ci` retry, and the Node/Electron setup for no benefit, and would create a second place where a release can be produced.

## D4: The Flathub policy and the AI Slop evidence (recorded, factual)

**Finding**: Flathub's Generative AI policy and its reviewers treat AI-generated submissions strictly in practice, which is why this project declines the channel. The facts, without editorialising:

- Policy (https://docs.flathub.org/docs/for-app-authors/requirements#generative-ai-policy): submitters must disclose AI-generated application material; the manifest must contain no AI-generated or AI-assisted content even with disclosure; AI agents may not open or automate submission pull requests or write their text; disclosed application material is "evaluated at reviewer discretion", and reviewers "may reject a submission, including without further review".
- History: the near-blanket ban (May 2026) was replaced by a disclosure rule on 2026-09-04 (`flathub-infra/documentation` pull request 641) and the manifest rule was restored on 2026-09-21.
- Volume: on 2026-10-17 a GitHub search of the flathub/flathub repository for closed pull requests with the "AI Slop" label (described as "Mark obviously AI generated PR or app") returned a `total_count` of 1,220.
- Examples: PR #10676 (turbo-clicker) is human-run, source-built from a tag with a generated dependency manifest, discloses an AI-generated icon, and is in normal review. PR #10674 (LeatherClient) carried an agent-prepared manifest and was closed and labelled "AI Slop".
- Counter-evidence kept for accuracy: Flathub hosts AI applications, including the AI coding agent OpenCode (`ai.opencode.opencode`), LM Studio, Jan, and GPT4All, so the policy is not a category ban on AI software.

**Implication**: A project can satisfy the letter of the policy with a hand-written manifest and a human-run submission, but it must still disclose an AI-built codebase into a discretionary process whose observed default is rejection. The decision records that risk; the project declines Flathub and ships a `.deb` instead. No editorial commentary is recorded.

## D5: A `.deb` reaches the Debian family; an apt repository is a deliberate future option

**Finding**: A `.deb` release asset reaches Ubuntu, Linux Mint, Debian, and Pop!_OS (and derivatives), which are apt-based. It does not reach Fedora, openSUSE, or Arch, which need their own package formats. A bare release `.deb` installs but does not auto-update; automatic updates require an apt repository.

**Evidence**:

- Linux Mint is Ubuntu-based and apt-based, and it disables the Snap Store by default, so `.deb` is its native route (Linux Mint user guide, snap page).
- The repository question is settled in the ecosystem by three options: a Launchpad PPA (free, Ubuntu-family, but source-only: Launchpad builds the package, it does not accept a binary `.deb`); a managed apt repository that accepts binary `.deb` uploads (Cloudsmith, Gemfury, Packagecloud, which host a signed repo); or self-hosting. Anthropic ships Claude Desktop exactly this way: a `.deb` plus an apt repository, where the `.deb` also registers the repository so later updates arrive through `apt`.
- None of these gives a central "known" third-party repo: Debian and Ubuntu archives take software only through sponsorship and review, not a binary submission, and Mint does not accept third-party submissions.

**Implication**: Shipping the `.deb` as a release asset is the minimum and needs no infrastructure. An apt repository (for `apt upgrade` to deliver new versions) is a separate, later feature if wanted; it is out of scope here. The README documents the release-asset path and names the distributions covered.

## References

- Debian package format: `deb(5)` and Debian policy (the `ar` container with `debian-binary`, `control.tar.*`, `data.tar.*`).
- electron-builder Debian target and options: `node_modules/app-builder-lib/out/targets/FpmTarget.js`, `out/options/linuxOptions.d.ts`, `out/appInfo.js`.
- Release workflow: `.github/workflows/build-release.yml`.
- Flathub Generative AI policy: `https://docs.flathub.org/docs/for-app-authors/requirements#generative-ai-policy`; policy history `https://github.com/flathub-infra/documentation/pull/641`; "AI Slop" label `https://api.github.com/repos/flathub/flathub/labels/AI%20Slop`; example submissions `https://github.com/flathub/flathub/pull/10676` and `https://github.com/flathub/flathub/pull/10674`; AI apps on Flathub `https://flathub.org/apps/ai.opencode.opencode`.
- Linux Mint snap policy: `linuxmint-user-guide.readthedocs.io/en/latest/snap.html`.
- Claude Desktop Linux distribution (apt repository plus `.deb`): `code.claude.com/docs/en/desktop-linux`.
