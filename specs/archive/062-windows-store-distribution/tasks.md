# Tasks: Windows Store Distribution

**Input**: Design documents from `/specs/archive/062-windows-store-distribution/`

**Prerequisites**: plan.md, research.md, spec.md

**Tests**: Unit tests cover the pure submission-validation logic and the release-configuration guardrails (identity placeholder rejection, version derivation/comparison, manifest inspection, channel separation, capability discipline). Real Store discovery, certification, install, update, uninstall, and the spec 038 fault matrix cannot be exercised by the suite and are manual per spec Assumptions.

**Organization**: Planning artifacts → submission gate script → workflow → package/config → listing + docs → advertising → tests → gates → archive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story / concern the task serves
- Exact file paths in each description; commit after each task with the stated prefix

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write `specs/archive/062-windows-store-distribution/{plan.md,research.md,tasks.md}` citing spec 038's packaging research and re-verified electron-builder behaviour for identity substitution, version derivation, and capability generation. Commit `docs(062)`.

## Phase 2: Submission gate script (FR-003, FR-010, FR-017, SC-005, SC-008)

- [x] T002 [US3] Create `scripts/store-submission.mjs` and `scripts/store-submission.d.mts`: export `isPlaceholderIdentity`, `assertRealIdentity`, `toWindowsVersion`, `compareWindowsVersions`, `isVersionGreaterThan`, `parseManifestIdentity`, and CLI subcommands `validate`, `validate-manifest`, `assert-tag`. Fail closed with actionable, path-free messages. Commit `feat(062)`.

## Phase 3: Guarded workflow (FR-003, FR-010, FR-014, FR-017)

- [x] T003 [US3] Rewrite `.github/workflows/build-store.yml`: `workflow_dispatch` inputs `version` (required) and `publishedVersion` (optional); checkout with `fetch-depth: 0`; validate inputs; assert the version equals the release tag when dispatched on a tag; build the shell extension and app; package with `-c.extraMetadata.version`; unpack the `.appx` and verify `AppxManifest.xml` identity and version; keep the artifact name and `build-release.yml` untouched. Commit `feat(062)`.

## Phase 4: Package configuration (FR-011, FR-016)

- [x] T004 [P] [US5] Add an explicit `capabilities: [runFullTrust]` to the `appx:` block of `electron-builder.yml`; do not add `fileAssociations`, `protocols`, or `appx` to `win.target`. Commit `feat(062)`.

## Phase 5: Listing and submission documentation (FR-004, FR-013, FR-018, FR-019)

- [x] T005 [US5] Create `docs/store-listing.md`: product name, short and full description, category, age rating, Windows 11 folder-action statement, support/privacy URLs, screenshot and asset requirements, and the `runFullTrust` certification justification. Commit `docs(062)`.
- [x] T006 [P] [US5] Create `docs/site/privacy.html`: a self-contained privacy policy (no personal data collected) served by `pages-deploy.yml`, and link it from `docs/site/index.html` privacy reference. Commit `docs(062)`.
- [x] T007 [US3] Extend `docs/store-release.md`: reference `scripts/store-submission.mjs` as the pre/post gate, document the version-monotonicity input, the spec 038 fault-matrix submission gate, the listing checklist, and the update procedure. Commit `docs(062)`.

## Phase 6: Advertising the channel (FR-012)

- [x] T008 [US1] Add a Microsoft Store install section to `README.md` and a Store navigation link to `docs/site/index.html` pointing at the Store search URL, noting the Windows 11 folder-action requirement and the in-app Open Folder fallback for Windows 10. Commit `docs(062)`.

## Phase 7: Tests (SC-005, SC-008, SC-009 guards)

- [x] T009 [US3] Create `tests/main/storeSubmission.test.ts`: pure-function cases (placeholder/variable identity, semver validation, four-part Windows form, strictly-greater comparison, manifest attribute parsing with single and double quotes) plus CLI exit codes for a placeholder identity and a non-increasing version. Commit `test(062)`.
- [x] T010 [P] [US3] Create `tests/main/storeReleaseConfig.test.ts`: assert the appx block declares only `runFullTrust`, declares no `fileAssociations`/`protocols`, `build-release.yml` does not build `appx`, and `build-store.yml` does not publish a release or run the package-definition updaters. Commit `test(062)`.
- [x] T011 [US1] Extend `tests/main/siteContract.test.ts` and `tests/main/storeManifest.test.ts` as needed for the Store navigation target and the explicit capability. Commit `test(062)`.

## Phase 8: Gates and lifecycle

- [x] T012 Run gates until green: append the new `scripts`/`tests` files to `package.json`'s `format:check` list; `npm run format:check`; `npm run lint`; `npm run typecheck`; `npm run check`; `npm test`; LAST `npm run test:e2e`.
- [ ] T013 Manual follow-ups (NOT automatable here): reserve the Partner Center product, set `STORE_IDENTITY_NAME`/`STORE_PUBLISHER` repository variables, dispatch `build-store.yml` from the release tag, run `specs/archive/038-win11-first-level-menu/quickstart.md` US1–US5 including the fault matrix against the submission candidate, assemble the listing from `docs/store-listing.md`, submit, then replace the Store search URL in `README.md` and `docs/site/index.html` with the published product page. Record evidence separately. Never claim Store or Explorer behaviour not observed.
- [x] T014 Archive the spec (`git mv specs/062-windows-store-distribution specs/archive/062-windows-store-distribution`, set **Status** to Archived) as part of the implementation PR.

---

## Dependencies & Execution Order

- T001 first (artifacts before code, per AGENTS.md workflow).
- T002 precedes T003 (the workflow invokes the script) and T009 (tests import it).
- T003 precedes T007 (docs describe the final workflow).
- T004/T005/T006/T008 are independent of each other but T008's note depends on T005's folder-action wording.
- T009/T010/T011 after their targets exist; T012 last among automated tasks; T013 stays open beyond this branch.

## Notes

- Never modify the non-Store channel registration surface: `scripts/installer.nsh`, `scripts/open-with.ps1`, `markdownmeister.json`, `Formula/`, `updatescoop.ps1`, `updatebrew.ps1`, `updatepackagejson.ps1`, or existing `electron-builder.yml` values (spec 038 SC-003).
- Structural vs behavioural changes never share a commit (Tidy First).
