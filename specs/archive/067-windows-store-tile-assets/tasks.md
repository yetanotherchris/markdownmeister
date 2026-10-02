# Tasks: Windows Store Tile Assets

**Input**: Design documents from `/specs/archive/067-windows-store-tile-assets/`

**Prerequisites**: plan.md, research.md, spec.md

**Tests**: Unit tests cover the asset set, its wiring, and the derivation. The real Store listing and the certification re-submission cannot be exercised by the suite and are manual per spec Assumptions. No Playwright e2e spec is added: the tile surfaces are the Store listing and the Windows Shell, not the application window (plan Technical Context).

**Organization**: Planning artifacts → derivation → package configuration → provenance and listing docs → tests → gates → archive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story / concern the task serves
- Exact file paths in each description; commit after each task with the stated prefix

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write `specs/067-windows-store-tile-assets/{plan.md,research.md,tasks.md}` citing the re-verified electron-builder appx asset lookup and fallback, the tile composition decision, and the sampled background colour. Commit `docs(067)`.

## Phase 2: Derive the package tile set (FR-004, FR-005, FR-006, SC-003, SC-004)

- [x] T002 [US3] Extend `scripts/generate-icons.ps1` to emit the appx tile set into `resources/appx/`: `StoreLogo.png` (50×50), `Square44x44Logo.png` (44×44), `Square150x150Logo.png` (150×150), `LargeTile.png` (310×310), `SmallTile.png` (71×71), and `Wide310x150Logo.png` (310×150) composed as the square mark scaled to a safe area and centred on a transparent canvas. Update the script header's output list and the "do not write to build/" note. Commit `feat(067)`.
- [x] T003 [US3] Run `pwsh -File scripts/generate-icons.ps1` and commit the six generated `resources/appx/*.png` files. Commit `feat(067)`.

## Phase 3: Wire the package configuration (FR-001, FR-003, FR-007, SC-001, SC-002)

- [x] T004 [US2] In `electron-builder.yml`: set `directories.buildResources: resources` and set `appx.backgroundColor` to `#222540` (the master's modal navy), with a comment stating why the build-resources root is repointed. Do not change `win.icon`, `mac.icon`, `linux.icon`, identity, capabilities, or the shell-extension keys. Commit `feat(067)`.

## Phase 4: Provenance and listing documentation (FR-002, FR-008, FR-009, SC-002)

- [x] T005 [P] [US3] Update `docs/icon-provenance.md`: add the appx tile set to the derivation chain diagram and the consumers list, and note the wide tile is a centred composition. Commit `docs(067)`.
- [x] T006 [P] [US2] Update `docs/store-listing.md`: replace the line claiming default package tiles are acceptable with instructions to upload the branded `assets/windows-store/` logos and to confirm the package's branded tiles before submitting; add the tile assets to the pre-submission checklist. Commit `docs(067)`.
- [x] T011 [US2] Move the promotional Partner Center listing art from `store-assets/` to `assets/windows-store/` (new work discovered during review) and update its references. Commit `refactor(067)`.

## Phase 5: Tests (FR-001, FR-003, FR-006, SC-003)

- [x] T007 [US2] Create `tests/main/storeTileAssets.test.ts`: assert `electron-builder.yml` sets `directories.buildResources: resources` and a non-default `appx.backgroundColor`; assert each required `resources/appx/*.png` exists with the exact expected dimensions read from the PNG IHDR; assert no `SampleAppx`-named asset is present; assert `scripts/generate-icons.ps1` names each tile output. Commit `test(067)`.

## Phase 6: Gates and lifecycle

- [ ] T008 Run gates until green: append the new test file to `package.json`'s `format:check` list; `npm run format:check`; `npm run lint`; `npm run typecheck`; `npm run check`; `npm test`; LAST `npm run test:e2e`.
- [ ] T009 Manual follow-ups (NOT automatable here): upload the branded `assets/windows-store/` tile logos to Partner Center's Store logos for the reserved product; rebuild the Store package; confirm the packaged `assets\*.png` are the branded files (unpack the `.appx` and compare against `resources/appx/`); re-submit and record the outcome. Never claim Store behaviour not observed.
- [x] T010 Archive the spec (`git mv specs/067-windows-store-tile-assets specs/archive/067-windows-store-tile-assets`, set **Status** to Archived) as part of the implementation PR.

---

## Dependencies & Execution Order

- T001 first (artifacts before code, per AGENTS.md workflow).
- T002 precedes T003 (the script produces the assets).
- T003 and T004 are independent of T005/T006.
- T007 after T002–T004 (it asserts the script, the assets, and the configuration).
- T008 last among automated tasks; T009 stays open beyond this branch.

## Notes

- Never modify the non-Store channel registration surface: `scripts/installer.nsh`, `scripts/open-with.ps1`, `markdownmeister.json`, `Formula/`, `updatescoop.ps1`, `updatebrew.ps1`, `updatepackagejson.ps1`, or existing `electron-builder.yml` values (spec 038 SC-003).
- The master artwork is never written; only `resources/appx/` and the existing derived assets are produced.
- Structural vs behavioural changes never share a commit (Tidy First).
- T008 status: `lint`, `typecheck`, the maintainability check, and unit tests are green (1073/1073). The e2e suite reported 429 passed and two failures with no connection to this change (`open-performance.spec.ts` p95 timing and `recent.deleted.spec.ts` afterEach timeout); neither touches tile assets or packaging configuration. Confirm on the Linux e2e image (AGENTS) before declaring T008 complete.
