# Tasks: Debian Package Distribution (No Flathub)

**Input**: Design documents from `/specs/070-deb-file-distribution/`

**Prerequisites**: plan.md, research.md, spec.md

**Tests**: Unit guards cover the release configuration (the `deb` target is present and the AppImage is unchanged, the required Debian metadata exists, the release workflow uploads and verifies `dist/markdownmeister_*.deb`, and the README documents the install methods). Building the `.deb` is verified on CI; a real graphical-installer install, menu launch, and uninstall on Mint and Ubuntu remain manual per spec Assumptions.

**Organization**: Planning artifacts, then the package target and its metadata, then the release workflow, then documentation, then the site, then tests, then gates, then archive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story / concern the task serves
- Exact file paths in each description; commit after each task with the stated prefix

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write `specs/070-deb-file-distribution/{plan.md,research.md,tasks.md,checklists/requirements.md}` with the `.deb` format, the electron-builder requirements, the no-new-workflow decision, and the Flathub facts (links only, no opinion). Completed in the planning PR; corrected artifact-name inheritance during implementation.

## Phase 2: Debian package target and metadata (FR-001, FR-002, FR-005, FR-011)

- [x] T002 [US1] Add a `deb` block to `electron-builder.yml` (`maintainer`, `category`, and any needed `depends`), and supply the homepage and author the Debian builder requires (a `package.json` `homepage` and `author`, or a `homepage` plus `deb.maintainer`). Do not change `linux.artifactName`, `linux.icon`, or the AppImage target; the `deb` target is additive. Commit `feat(070)`.

## Phase 3: Release workflow (FR-001, FR-008)

- [x] T003 [US2] In `.github/workflows/build-release.yml`: add `dist/markdownmeister_*.deb` to the Linux upload glob and to the `release` job's `Verify required artifact set` list. Leave the `Package (Linux)` command and every non-Linux leg unchanged. No new workflow. Commit `ci(070)`.

## Phase 4: Documentation (FR-007)

- [x] T004 [US1] In `README.md`, remove the existing `### Linux (Flathub)` subsection (the listing will not exist) and add a `### Linux (Debian, Ubuntu, Mint)` section: download the `.deb` from the releases page, install by opening it in the software installer or with `sudo apt install ./markdownmeister_<version>_amd64.deb`, note that it is amd64 and covers Ubuntu, Linux Mint, Debian, and Pop!_OS, and give `sudo apt remove markdownmeister` to uninstall. Commit `docs(070)`.
- [x] T005 [US3] Rewrite `docs/linux-store-release.md` as a numbered Snap Store delivery guide matching the Apple guide. Acknowledge completed setup, document the existing build, verification and publication steps, omit specification references, and state that Flathub is unsupported with its policy link. Link to direct-download installation in the README. Updated per the maintainer's 2026-10-18 request. Commit `docs(070)`.

## Phase 5: Site (FR-007)

- [x] T006 [US1] In `docs/site/src/content.ts` and `docs/site/src/site.tsx`, replace the "Linux (Flathub)" entry with the `.deb` route (link the releases page), and remove the `flathubUrl` export and its use. Commit `docs(070)`.

## Phase 6: Tests

- [x] T007 [US2] Extend `tests/main/linuxStoreConfig.test.ts`: assert `linux.target` contains `deb` and the unchanged AppImage, that the Debian build has a homepage and a maintainer, that `build-release.yml`'s upload glob and required-artifact list include `dist/markdownmeister_*.deb`, that no Flathub manifest is committed, and that the README documents `apt install ./` and `apt remove`. In `tests/main/siteContract.test.ts`, drop `flathub.org` from the allowed hosts. Commit `test(070)`.

## Phase 7: Gates and lifecycle

- [ ] T011 Add a Linux-only packaging acceptance test in `tests/e2e/deb-distribution.spec.ts`: build the `.deb` with a release-version override, inspect its metadata and desktop entry, extract its payload, launch the packaged app, and verify its version. Copy `electron-builder.yml` into the existing Linux e2e image. Add a built-site browser check for the Debian install instructions. This provides PR-time Linux package verification while local Docker and WSL are unavailable; graphical installer and apt checks remain T009. Commit `test(070)`.

- [ ] T008 Confirm the artifact and the version path: `git grep -n -i flathub -- README.md docs/site tests/main` returns nothing, and a local Linux build (`npx electron-builder --linux deb --x64 --publish never`) produces `dist/markdownmeister_<version>_amd64.deb`. Run `npm run lint`, `npm run typecheck`, `npm run test`, and LAST `npm run test:e2e` (using the Linux Docker image for the Linux-specific checks).
- [ ] T009 Manual follow-ups (NOT automatable here): on Linux Mint and on Ubuntu, install the `.deb` both ways (double-click through the software installer and `sudo apt install ./<file>.deb`), confirm the menu entry launches the app, confirm the reported version equals the release, and confirm `sudo apt remove markdownmeister` leaves no files. Record evidence separately. Never claim behaviour not observed.
- [ ] T010 Archive the spec (`git mv specs/070-deb-file-distribution specs/archive/070-deb-file-distribution`, set **Status** to Archived) as part of the implementation PR.

---

## Dependencies & Execution Order

- T001 first (artifacts before code, per AGENTS.md workflow).
- T002 precedes T003 (the workflow publishes the configured target) and T007 (the test asserts the target and metadata).
- T003 precedes T007 (the test asserts the workflow's artifact set).
- T004, T005, T006 are independent of each other; their wording depends on T002 for the exact package name.
- T007 after T002-T006; T008 last among automated tasks; T009 stays open beyond this branch; T010 as part of the implementation PR.

## Notes

- Never change the AppImage or snap configuration, or the release workflow's non-Debian legs. The `deb` target is additive.
- No Flathub manifest, no Flatpak metadata, and no apt repository are created (FR-009, FR-012). The repository is a deliberate future feature (research D5).
- The `.deb` artifact name is `markdownmeister_<version>_amd64.deb` (Debian convention), which differs from the `linux.artifactName` used by the AppImage; both coexist in `dist/`.
- Structural vs behavioural changes never share a commit (Tidy First).
