# Tasks: Linux Store Distribution (Flathub and Snap Store)

**Input**: Design documents from `/specs/archive/064-linux-store-distribution/`

**Prerequisites**: plan.md, research.md, spec.md

**Tests**: Unit tests cover the pure submission-validation logic and the release-configuration guardrails (version/tag agreement, artifact naming, credential gating, snap confinement and plug discipline, channel identity). Real snap install, sandbox prompts, published-revision upgrade, desktop integration, the Flathub build and lint, and both store reviews cannot be exercised by the suite and are manual per spec Assumptions.

**Organization**: Planning artifacts → submission script → snap config → workflow → release documentation → advertising → tests → gates → archive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story / concern the task serves
- Exact file paths in each description; commit after each task with the stated prefix

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write `specs/064-linux-store-distribution/{plan.md,research.md,tasks.md}` citing verified electron-builder 26.15.3 snap behaviour and the Flathub policy constraint. Commit `docs(064)`.

## Phase 2: Submission gate script (FR-012, FR-018, SC-005)

- [x] T002 [US5] Create `scripts/linux-store-submission.mjs` and `scripts/linux-store-submission.d.mts`: export `isSemver`, `assertVersionMatchesTag`, `assertSnapArtifactName`, `hasSnapCredentials`, and CLI subcommands `validate` and `assert-tag`. Fail closed with actionable, path-free messages. Commit `feat(064)`.

## Phase 3: Snap package configuration (FR-002, FR-003, FR-004, FR-008, FR-019)

- [x] T003 [US2] Add a `snap` block to `electron-builder.yml` with `title`, `summary`, `description`, `confinement: strict`, `grade: stable`, and the explicit minimal `plugs` set from research D3. Do not add `snap` to `linux.target`. Commit `feat(064)`.

## Phase 4: Build and publish workflow (FR-012, FR-013, FR-018)

- [x] T004 [US5] Create `.github/workflows/build-linux-store.yml`: dispatch inputs `version` (required) and `publish` (boolean, default false); checkout with `fetch-depth: 0` and `fetch-tags: true`; validate the version and assert it against the tag; build; package `--linux snap --x64` with `-c.extraMetadata.version`; verify the `.snap` name; publish to `stable` with `snapcraft upload` only when `publish` is true and `SNAPCRAFT_STORE_CREDENTIALS` is set; upload the artifact. Pin every action to a full commit SHA. Commit `feat(064)`.

## Phase 5: Release documentation (FR-011, FR-015, FR-016, FR-018, SC-007, SC-008)

- [x] T005 [US5] Create `docs/linux-store-release.md`: the Snap Store release procedure (register the name, set the credential, dispatch, verify install/upgrade/removal, sandbox permission and plug-justification checks, discover the listing metadata), and the Flathub procedure the maintainer must author and run (application ID `io.github.yetanotherchris.MarkdownMeister`, x64, runtime/base, minimum `finish-args`, metainfo/desktop/icon/licence metadata, offline sources, lint, local install-and-launch, submission), stating the FR-016 no-AI constraint. Commit `docs(064)`.

## Phase 6: Advertising the channels (FR-014)

- [x] T006 [US1] Add Linux (Flathub) and Linux (Snap Store) install entries to `README.md` and to `docs/site/src/{content.ts,site.tsx}`, with correct commands/links and an honest availability note, and extend `tests/main/siteContract.test.ts`'s allowed host set. Commit `docs(064)`.

## Phase 7: Tests (SC-003, SC-006, SC-009 guards)

- [x] T007 [US3] Create `tests/main/linuxStoreConfig.test.ts`: pure-function cases for the submission script plus guards that `linux.target` has no snap target, the snap block is strict-grade/stable, the plug set omits the unused defaults, no credential appears in the repository, `build-release.yml` does not build a snap or publish to the Snap Store, and the AppImage desktop-entry name stays distinct and APPIMAGE-gated. Commit `test(064)`.

## Phase 8: Gates and lifecycle

- [x] T008 Add the new `scripts`/`tests` files to `package.json`'s `format:check` list and the site sources already there; run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run check`, `npm test`, `npm run docs:build`, and LAST `npm run test:e2e` (using the Linux Docker image for the Linux-specific checks).
- [ ] T009 Manual follow-ups (NOT automatable here): register the `markdownmeister` snap name, set the `SNAPCRAFT_STORE_CREDENTIALS` secret, dispatch `build-linux-store.yml` from a release tag, complete the store listing (summary, description, screenshots, icon, licence, homepage), verify snap install/upgrade/removal and the folder-sandbox matrix on a real Ubuntu machine (including the folder Open With fallback of FR-009 and the `removable-media` connection for folders outside `$HOME`), and, for Flathub, have the maintainer author the manifest and open the submission. Record evidence separately. Never claim a store behaviour not observed.
- [x] T010 Archive the spec (`git mv specs/064-linux-store-distribution specs/archive/064-linux-store-distribution`, set **Status** to Archived) as part of the implementation PR.

---

## Dependencies & Execution Order

- T001 first (artifacts before code, per AGENTS.md workflow).
- T002 precedes T004 (the workflow invokes the script) and T007 (tests import it).
- T003 precedes T004 (the workflow builds the configured target) and T005 (the docs describe the final config).
- T005 depends on T003/T004; T006 is independent of T004 but its availability note depends on T005's wording.
- T007 after its targets exist; T008 last among automated tasks; T009 stays open beyond this branch.

## Notes

- Never modify the non-Store channel registration surface: `scripts/installer.nsh`, `scripts/open-with.ps1`, `markdownmeister.json`, `Formula/`, `updatescoop.ps1`, `updatebrew.ps1`, `updatepackagejson.ps1`, or the existing AppImage values in `electron-builder.yml` (`linux.artifactName`, `linux.icon`, `linux.target`). The `snap` block is a new top-level key only.
- Structural vs behavioural changes never share a commit (Tidy First).
