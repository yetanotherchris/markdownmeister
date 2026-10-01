# Implementation Plan: Linux Store Distribution (Flathub and Snap Store)

**Branch**: `spec-064-linux-store-distribution` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

## Summary

Deliver the Snap Store channel end to end and specify the Flathub channel as a maintainer-run procedure. The snap is a separate electron-builder target that the new `build-linux-store.yml` workflow selects on the command line, so `npm run dist` keeps producing only the direct-download AppImage and nothing about that channel changes. The snap builds through electron-builder's core22 template path (name `markdownmeister`, strict confinement, an explicit minimal plug set), is version-gated against the release tag by a pure script, and is published only when a store credential is present and publishing is explicitly requested. Flathub's application ID (`io.github.yetanotherchris.MarkdownMeister`), runtime, permissions, metadata, and submission are documented, not authored here: Flathub policy requires the maintainer to write the manifest and open the submission (FR-016), so the manifest is a maintainer task like spec 062's Partner Center step.

## Technical Context

**Language/Version**: YAML for the build config and workflow; Node.js 22 ESM for the validation script; TypeScript 5.8 strict for tests. No application (Electron/React) runtime change.

**Primary Dependencies**: None new. electron-builder 26.15.3 already ships the `snap` target (`node_modules/app-builder-lib/out/targets/snap/`), and its core22 template path downloads a prebuilt Electron snap template and packs it with `mksquashfs`, so the snap build needs neither `snapcraft` nor a virtual machine on the CI host (research D1). Publishing to the Snap Store uses the `snapcraft` CLI with `SNAPCRAFT_STORE_CREDENTIALS`, which is only installed in the opt-in publish step.

**Storage**: No application storage. The workflow reads the dispatched `version` input and the `SNAPCRAFT_STORE_CREDENTIALS` secret, and writes only the `.snap` artifact into `dist/`.

**Testing**: Vitest unit tests for the pure version/artifact/credential validation functions and for the release-configuration guardrails (snap target present but not in `linux.target`, confinement strictly `strict`, no unused restricted plug, no network/audio plug, channel identity distinct, AppImage workflow untouched). Real snap install, sandbox permission prompts, published-revision upgrade, desktop integration, and the Flathub build and review are manual by nature (spec Assumptions) and are documented as gates in `docs/linux-store-release.md`.

**Target Platform**: Linux x64. Snap install target is a stock Ubuntu machine with snapd; Flathub targets any distribution with Flathub enabled. The direct-download AppImage remains available and unchanged.

**Constraints**: Never mutate the non-Store channel registration surface. Do not add `snap` to `linux.target` in `electron-builder.yml`; the workflow selects the target. The AppImage's self-written desktop entry must stay gated on `process.env.APPIMAGE` so a store build never writes or removes it (FR-017). No credentials in the repository (FR-012).

**Scale/Scope**: One `snap` block in `electron-builder.yml`, one workflow, one validation script plus types, one release procedure document, targeted `README.md` and `docs/site` install-section updates, one new unit-test file, one extended test assertion, and `package.json` gate-list edits. The Flathub manifest and submission are documented maintainer tasks, not code.

## Constitution Check

*GATE: Checked against every principle.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None. No renderer, preload, IPC, or app-process change. The workflow and script run outside the shipped app. |
| II. Every Path Is Untrusted | Unchanged and deliberately so. A folder opened inside the snap still lands in the same main-process pipeline; the sandbox grants the app access to the user's chosen folders and nothing more (the `home` interface, with `removable-media` left unconnected). |
| III. Never Lose The User's Words | Unchanged. Nothing here touches save or dirty-state behaviour. |
| IV. Calm, Predictable Editing | Unchanged. No runtime UI change. |
| V. Test What Can Corrupt Or Escape | Honoured. The new gates are automated tests plus a fail-closed workflow check: a non-tag version, a version that disagrees with the tag, a missing artifact, or a publish attempt without credentials stops the run before anything is uploaded. |

All gates pass. No deviations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/064-linux-store-distribution/
├── plan.md              # This file
├── research.md          # D1–D6 decisions with evidence
├── tasks.md             # Ordered, independently verifiable work items
├── spec.md              # Requirements
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
scripts/
├── linux-store-submission.mjs   # NEW: pure version/artifact/credential validation + CLI gate
└── linux-store-submission.d.mts # NEW: types for the script's exports
.github/workflows/
└── build-linux-store.yml        # NEW: build the snap, gate on version, publish when asked
electron-builder.yml             # ADDITIVE: a `snap` block (no change to linux.target)
docs/
└── linux-store-release.md       # NEW: Snap release procedure and Flathub maintainer procedure
docs/site/
├── src/content.ts               # CHANGED: Linux store URLs
└── src/site.tsx                 # CHANGED: Linux install entries
README.md                        # CHANGED: Flathub and Snap Store install sections
tests/main/
├── linuxStoreConfig.test.ts     # NEW: snap-config, credential, and channel-identity guards
└── siteContract.test.ts         # CHANGED: allow the Flathub/Snap hosts
package.json                     # CHANGED: gate lists
```

**Structure Decision**: Validation lives in `scripts/` (not `src/`) because it is build tooling consumed by CI, following the existing `scripts/store-submission.mjs` + `.d.mts` + Vitest pattern. The release procedure lives in `docs/` alongside `store-release.md`. The README and the project site both advertise the channels, matching how spec 062 advertised the Microsoft Store.

## Complexity Tracking

No constitutional deviations. Three recorded implementation choices that a reviewer might otherwise question:

1. **The Flathub manifest is not written here.** Flathub's published policy forbids AI-generated manifest content and AI-run submissions (spec FR-016), so the manifest and the submission are maintainer tasks. The plan documents exactly what the maintainer must author and verify; the feature's automated surface is the snap channel plus the README/site advertising. The rejected alternative (have the agent write the manifest) is prohibited by the spec, not merely discouraged.
2. **The snap target is selected on the command line, not added to `linux.target`.** Adding it to `linux.target` would make every local `npm run dist` and every other OS attempt a snap build, requiring the template download and `mksquashfs`; keeping the target out and selecting `--linux snap` in the workflow preserves the existing AppImage build exactly (FR-013, spec 038 precedent for `appx`).
3. **An explicit minimal plug set is declared instead of the electron-builder default.** FR-019 forbids unused interfaces, and the app makes no network or audio calls, so `network`, `audio-playback`, and `pulseaudio` are not declared. Trimming cannot be device-verified on Windows; it is listed as a real-device gate in `docs/linux-store-release.md` and in the tasks, in line with the spec's manual-verification assumption.
