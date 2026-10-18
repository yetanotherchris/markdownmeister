# Implementation Plan: Debian Package Distribution (No Flathub)

**Branch**: `spec-070-deb-file-distribution-implementation` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/070-deb-file-distribution/spec.md`

## Summary

Publish a Debian package (`.deb`) with every release, beside the existing AppImage, and document it. `electron-builder.yml` gains a `deb` target on the Linux build; because electron-builder's Debian packager requires a project homepage and a maintainer, both are supplied (`package.json` currently has neither). The existing release workflow already builds Linux on `ubuntu-latest`, so no new workflow is added: the upload glob and the required-artifact check gain the `.deb`, and the release's artifact list is updated. The README gains an install section. The Flathub procedure in `docs/linux-store-release.md` and the Flathub entry on the project site are replaced with the decision and the `.deb` route. No application code changes.

## Technical Context

**Language/Version**: YAML for `electron-builder.yml` and the workflow; JSON for `package.json` metadata; Markdown for the docs. No application (Electron/React) runtime change.

**Primary Dependencies**: electron-builder's `FpmTarget` (verified at `node_modules/app-builder-lib/out/targets/FpmTarget.js`), which builds `deb`/`rpm`/`pacman`. It is already the project's packager; the `deb` build needs `fpm` tooling that electron-builder bundles, and it runs on the `ubuntu-latest` release leg. No new dependency.

**Artifact naming**: Set `deb.artifactName` explicitly to `${name}_${version}_${arch}.${ext}` with `amd64` for x64, producing `markdownmeister_<version>_amd64.deb`. Inspection during implementation found that `FpmTarget` merges the Linux options and `PlatformPackager.artifactPatternConfig` prefers an explicit artifact name over the Debian default. Without this override, the existing `linux.artifactName` would produce the wrong filename. See research D6.

**Required metadata**: `FpmTarget.computeFpmMetaInfoOptions` throws unless a project homepage and a maintainer (name and email) are available. `package.json` has no `author`, `homepage`, or `repository` field, so the change must supply a homepage and a `deb.maintainer` (or a `package.json` author with an email). This is recorded in research D2.

**Storage**: No application storage. The release workflow writes `dist/markdownmeister_<version>_amd64.deb`; nothing else changes.

**Testing**: Vitest guards that `linux.target` contains the `deb` target and the unchanged AppImage, that the release workflow's upload glob and required-artifact list include `dist/markdownmeister_*.deb`, that the Debian build has a homepage and a maintainer, and that the README documents the two install methods. Building and installing the `.deb` is verified on CI (build) and manually on a real Mint and Ubuntu machine (graphical installer, menu launch, uninstall), per spec Assumptions.

**Target Platform**: Linux x64, Debian-family (Ubuntu, Linux Mint, Debian, Pop!_OS). The AppImage and snap channels are unchanged.

**Constraints**: Do not change `linux.artifactName`, `linux.icon`, or the AppImage target; the `deb` target is additive. Do not author or submit a Flathub manifest (FR-009). No credentials, no hosted repository (FR-012).

**Scale/Scope**: One additive `deb` target plus required metadata in `electron-builder.yml`/`package.json`, two small edits to `build-release.yml` (upload glob and required-artifact list; the package step is unchanged), a README section that also removes the Flathub subsection, a rewritten Flathub section in `docs/linux-store-release.md`, one site entry and its contract test, and guards in `tests/main/linuxStoreConfig.test.ts`. No new workflow.

## Constitution Check

*GATE: Checked against every principle.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None. No renderer, preload, IPC, or app-process change. |
| II. Every Path Is Untrusted | Unchanged. The `.deb` installs the same application; on first run it opens folders through the same main-process pipeline. |
| III. Never Lose The User's Words | Unchanged. Nothing touches save or dirty-state behaviour. |
| IV. Calm, Predictable Editing | Unchanged. No runtime UI change. |
| V. Test What Can Corrupt Or Escape | Honoured at the packaging level: a required-artifact check fails the release when the `.deb` is missing or misnamed, and unit guards assert the target and metadata are present. |

All gates pass. No deviations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/070-deb-file-distribution/
├── plan.md              # This file
├── research.md          # D1-D5, including the `.deb` format
├── tasks.md             # Ordered work items
├── spec.md              # Requirements and the Flathub decision
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
electron-builder.yml                 # ADDITIVE: a `deb` block; AppImage unchanged
package.json                         # ADDITIVE: homepage and author (maintainer) metadata
.github/workflows/
└── build-release.yml                # CHANGED: publish and verify dist/markdownmeister_*.deb
README.md                            # CHANGED: a "Linux (Debian, Ubuntu, Mint)" install section; the Flathub subsection removed
docs/linux-store-release.md          # CHANGED: Flathub section replaced by the decision and the `.deb` route
docs/site/src/
├── content.ts                       # CHANGED: a `.deb`/releases URL, remove flathubUrl
└── site.tsx                         # CHANGED: replace the Flathub entry with the `.deb` route
tests/main/
├── linuxStoreConfig.test.ts         # CHANGED: deb target, release-list, metadata, README guards
└── siteContract.test.ts             # CHANGED: drop flathub.org from the allowed hosts
```

**Structure Decision**: The change stays in the packaging and release surface. The `.deb` is produced by electron-builder and published by the existing release workflow, following the additive-target pattern used for `appx` (spec 062) and `snap` (spec 064). Documentation lives in `docs/`, and the site is updated because it currently advertises a Flathub listing that will not exist.

## Complexity Tracking

### Implementation decisions (2026-10-18)

- The original spec branch is occupied by the worktree used for the merged planning PR. Implementation uses a new branch from current `main`, `spec-070-deb-file-distribution-implementation`.
- Supply `package.json.homepage` and Debian-only maintainer, description, category, and package section. Keep electron-builder's default Debian dependencies rather than replacing its maintained list. Set the Debian artifact name explicitly as described above.
- The maintainer requested a complete rewrite of the Linux store guide to match the Apple guide: numbered operational steps, completed Snap Store setup acknowledged, no specification references, and an explicit unsupported-Flathub note. This replaces T005's earlier instruction to retain the Snap sections verbatim. The guide links to the README for direct-download installation.

### Complexity assessment

No constitutional deviations. Three recorded choices:

1. **No new workflow.** The existing release workflow builds Linux on `ubuntu-latest`; adding the `deb` target and the artifact to its upload glob is smaller and keeps one origin for the release. A separate `build-deb.yml` would duplicate the version gate and the Node/Electron setup for no gain. Recorded in research D3.
2. **`package.json` gains metadata.** Adding a homepage and an author (or setting `deb.maintainer`) is required for the Debian builder; the AppImage did not need them. The alternative (a `deb.maintainer` only, with no homepage) is not possible because `FpmTarget` requires the homepage too. Recorded in research D2.
3. **The Flathub manifest is not written or submitted.** Flathub's policy requires the manifest and submission to be human-authored; this project is AI-driven, so the project declines the channel rather than produce an AI-written manifest. The decision and its links are recorded in the spec. The rejected alternative (write the manifest anyway) would violate the policy and is not taken.
