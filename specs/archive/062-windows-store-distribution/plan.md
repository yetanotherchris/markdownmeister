# Implementation Plan: Windows Store Distribution

**Branch**: `spec-062-windows-store-distribution` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/archive/062-windows-store-distribution/spec.md`

## Summary

Spec 038 already produces the Store-deliverable MSIX (the app plus the Windows 11 folder shell extension) through `.github/workflows/build-store.yml`; what is missing is the publication path. This feature turns the manually-dispatched, placeholder-tolerant workflow into a guarded submission pipeline and supplies the maintainer-facing artifacts the Store requires: real identity/version gating so a placeholder or stale version cannot be packaged, a listing content pack (name, descriptions, category, age rating, support and privacy links, screenshot requirements, the Windows 11 folder-action statement), a reachable privacy page on the existing GitHub Pages site, and README/site advertising. The app itself is not re-packaged and no application runtime behaviour changes: spec 038's packaging, hand-off pipeline, and channel-isolation guarantees are consumed unchanged.

## Technical Context

**Language/Version**: Node.js 22 ESM for the new build-verification script; PowerShell 7 for the workflow steps; YAML for the workflow; TypeScript 5.8 strict for tests. No application (Electron/React) code changes.

**Primary Dependencies**: None new. The verification script uses only Node built-ins (`node:fs`, `node:path`, `node:process`); it extracts the `Identity` element from `AppxManifest.xml` with a small attribute reader rather than adding an XML dependency, because the manifest itself is generated and substituted by electron-builder (spec 038 research R4) and the script only needs to read three attribute values.

**Storage**: No application storage. The submission pipeline reads repository variables `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` and the dispatched `version` input; it writes only the unsigned `.appx` artifact into `dist/`.

**Testing**: Vitest unit tests for the pure validation functions (placeholder detection, semver-to-MSIX version derivation and comparison, manifest identity parsing) and for the release-configuration guardrails (channel separation, capability discipline, no advertised file association). The site contract test is extended to accept the Store navigation target. Real Store discovery, certification, install, update, uninstall, and the spec 038 fault matrix remain manual by nature (spec Assumptions) and are documented as gates in `docs/store-release.md`.

**Target Platform**: Windows 10 build 19041+ (package installs and runs); the Explorer folder action is Windows 11 only (FR-019).

**Constraints**: Never mutate the non-Store channel registration surface (spec 038 SC-003). Do not add `appx` to `win.target` in `electron-builder.yml`; the Store workflow selects the target on the command line. Placeholder identity must fail the build, not warn.

**Scale/Scope**: One new verification script (+ types), one workflow rewrite, one listing document, one privacy page, targeted updates to `README.md`, `docs/site/index.html`, `docs/store-release.md`, `electron-builder.yml`, two new unit-test files, and one extended test assertion.

## Constitution Check

*GATE: Re-checked against every principle; no principle is engaged differently from spec 038, which this feature builds on.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None. No renderer, preload, IPC, or app-process change. The workflow and scripts run outside the shipped app. |
| II. Every Path Is Untrusted | Unchanged and deliberately so. The Store folder hand-off lands in the same main-process argv pipeline (`extractTargetFromArgv` → `classifyOsTarget` → `prepareFolderFromOsPath`) proven by spec 038; this feature adds no new path entry point. |
| III. Never Lose The User's Words | Unchanged. Nothing here touches save or dirty-state behaviour. |
| IV. Calm, Predictable Editing | Unchanged. No runtime UI change; the README/site copy is documentation. |
| V. Test What Can Corrupt Or Escape | Honoured. The new gates are automated tests plus a fail-closed workflow check: a placeholder identity, an invalid or non-increasing version, or a manifest whose identity disagrees with the submission inputs stops the build before an artifact exists. |

All gates pass. No deviations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/archive/062-windows-store-distribution/
├── plan.md              # This file
├── research.md          # D1–D5 decisions with evidence
├── tasks.md             # Ordered, independently verifiable work items
├── spec.md              # Requirements (with the 2026-09-30 clarifications)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
scripts/
├── store-submission.mjs        # NEW: pure identity/version validation + CLI gate
└── store-submission.d.mts      # NEW: types for the script's exports
.github/workflows/
└── build-store.yml             # CHANGED: version input, identity/version gates, manifest verification
electron-builder.yml            # ADDITIVE: explicit runFullTrust capability (no other appx change)
docs/
├── store-release.md            # CHANGED: identity source, version gate, fault-matrix gate, listing checklist, update procedure
└── store-listing.md            # NEW: ready-to-paste Store listing content pack
docs/site/
├── index.html                  # CHANGED: Microsoft Store navigation link
└── privacy.html                # NEW: privacy policy (reachable URL for the listing)
README.md                       # CHANGED: Microsoft Store install section and Windows 11 folder-action note
tests/main/
├── storeSubmission.test.ts     # NEW: validation-function and CLI tests
├── storeReleaseConfig.test.ts  # NEW: channel-separation, capability, and no-file-association guards
└── siteContract.test.ts        # CHANGED: allow and assert the Store navigation target
```

**Structure Decision**: Submission validation lives in `scripts/` (not `src/`) because it is build tooling consumed by CI, following the existing `scripts/check-maintainability.mjs` + `.d.mts` + Vitest pattern. Listing and privacy content live under `docs/` because `docs/site/` is published verbatim by `pages-deploy.yml`, which makes the privacy URL reachable without new hosting.

## Complexity Tracking

No constitutional deviations. Two recorded implementation choices that a reviewer might otherwise question:

1. **Repository variables are the only CI identity path.** `build-store.yml` reads `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` and fails when they are unset or still placeholders. Editing `electron-builder.yml`'s placeholders remains a local-only convenience for a packaging smoke test; committing real identity values to the file is not a supported CI path. The simpler alternative (let the file be edited and skip the variable check) was rejected because it lets a placeholder package reach Partner Center, which FR-003 forbids.
2. **Manifest identity is verified by unpacking the produced `.appx`.** The pre-build check validates the inputs; the post-build check reads `AppxManifest.xml` out of the artifact, so a substitution mistake fails the build rather than the certification queue. The alternative (trust the template substitution) was rejected because it cannot catch an empty-variable build.
