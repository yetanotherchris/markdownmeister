# Tasks: First-Level Folder Context Menu on Windows 11

**Input**: Design documents from `/specs/038-win11-first-level-menu/`

**Prerequisites**: plan.md, research.md, contracts/handoff.md, quickstart.md

**Tests**: Unit tests cover everything the repository can test directly (channel-isolation guard, argv parity, adversarial paths, manifest well-formedness); e2e covers cold-launch and running-instance hand-off by spawning the real binary. Explorer menu placement, Store submission, and US5 fault injection are manual per spec Assumptions.

**Organization**: Planning artifacts → native component → packaging/manifest → guard + parity tests → workflow + docs → gates → archive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story / concern the task serves
- Exact file paths in each description; commit after each task with the stated prefix

---

## Phase 1: Planning artifacts

- [x] T001 [docs] Write specs/038-win11-first-level-menu/{plan.md,research.md,contracts/handoff.md,quickstart.md,tasks.md} with primary-source evidence for the MSIX+IExplorerCommand+fileExplorerContextMenus mechanism, the alias invocation contract, the FR-013 limitation record, and the manual Store/US5 checklists. Commit `docs(038)`.

## Phase 2: Native shell-extension component (US5 containment, FR-002/FR-006/FR-012)

- [ ] T002 [US5] Create native/shell-extension/: src/dllmain.cpp (WRL module glue), src/ExplorerCommand.h/.cpp (IExplorerCommand implementation — title "Open in MarkdownMeister", icon from packaged exe, SEH-guarded methods, Invoke launches alias detached with quoted folder arg, no UI/no waits/no persistence) and CMakeLists.txt (MSVC x64 shared library). Commit `feat(038)`.
- [ ] T003 [P] [chore] Create scripts/build-shell-extension.ps1: detect VS 2022 MSVC via vswhere, detect Windows SDK, locate cmake (VS-bundled or PATH), configure+build into native/shell-extension/out/, print clear requirement message and exit non-zero when tooling absent. Commit `feat(038)`.

## Phase 3: Packaging and manifest declarations (FR-001/FR-002/FR-007)

- [ ] T004 [US1] Create packaging/appx/extensions.xml (appExecutionAlias markdownmeister.exe + com:SurrogateServer class registration + desktop4:FileExplorerContextMenus Directory verb, namespaces declared locally) and add the ADDITIVE appx block + afterPack hook key to electron-builder.yml; create scripts/copy-shell-extension.cjs (copies built DLL into win-unpacked/resources/shell-extension when present, silent no-op otherwise so ordinary builds stay byte-identical). Attempt local unsigned packaging (`npx electron-builder --win appx --publish never`, signing disabled envs); if tooling blocks it, fall back to XML verification only and say so in the report. Commit `feat(038)`.
- [ ] T005 [P] [SC-003] Add fast-xml-parser devDependency; create tests/main/storeManifest.test.ts parsing the committed fragment spliced into electron-builder's real template (node_modules/app-builder-lib/templates/appx/appxmanifest.xml) asserting well-formedness plus required declarations (alias name, CLSID consistency, Type="Directory"). Commit `test(038)`.

## Phase 4: Channel isolation + hand-off parity tests (SC-003, US2/FR-004)

- [ ] T006 [US3] Create tests/fixtures/channel-baseline/ snapshots of scripts/installer.nsh, scripts/open-with.ps1, markdownmeister.json and tests/main/channelIsolation.test.ts: byte-compare installer.nsh/open-with.ps1; compare markdownmeister.json after stripping release-volatile fields (version/url/hash) so release-bot commits keep CI green while any registration-surface edit fails. Commit `test(038)`.
- [ ] T007 [US2] Create tests/main/storeHandoff.test.ts proving parity: alias-shaped argv ([…WindowsApps\markdownmeister.exe, folder]) vs classic verb-shaped argv produce identical extractTargetFromArgv/classifyOsTarget outcomes for a real temp folder; adversarial cases (deleted folder, reserved device names, nonexistent UNC host, non-string) fail closed with path-free messages. Commit `test(038)`.

## Phase 5: Workflow, docs, e2e (FR-001, deliverables 6–7)

- [ ] T008 [US1] Create .github/workflows/build-store.yml: workflow_dispatch, windows-latest, npm ci with retry, build shell extension, npm run build, unsigned appx packaging, upload msixupload artifact. build-release.yml untouched. Commit `feat(038)`.
- [ ] T009 [P] [docs] Create docs/store-release.md: Partner Center identity values, submission steps from the built artifact, US5 fault-injection procedure reference. Commit `docs(038)`.
- [ ] T010 [US2] Create tests/e2e/store-handoff.spec.ts: spawn the built binary (electron.exe out/main/index.js <folder>) cold with production single-instance settings and assert the workspace opens via CDP; running-instance routing via a real spawned secondary sharing the primary's profile; missing-folder cold launch fails closed with quiet footer note and unchanged session. Commit `test(038)`.

## Phase 6: Gates and lifecycle

- [ ] T011 Run gates in order until green: `npm run lint`; `npm run typecheck`; `npm test`; `npm run check`; append new src/test files to package.json format:check list and run `npx prettier --check` on them; LAST `npm run test:e2e` (retry apparent contention failures up to 3 times).
- [ ] T012 Archive: `git mv specs/038-win11-first-level-menu specs/archive/038-win11-first-level-menu`, set **Status** to Archived in spec.md, commit `docs(specs)`.
- [ ] T013 Manual follow-ups (NOT automatable here): Partner Center identity + submission per docs/store-release.md; run quickstart.md US1–US5 matrices against real artifacts including fault injection; record evidence separately. Never claim Explorer behaviour not observed.

---

## Dependencies & Execution Order

- T001 first (artifacts before code, per AGENTS.md workflow).
- T002/T003 precede T004's local packaging attempt (the DLL must exist for the full path; the fallback path documents absence honestly).
- T004 precedes T005 (manifest test reads packaging/appx/extensions.xml).
- T006/T007 independent of Phases 2–3 files but land before T011.
- T011 runs last among automated tasks; T012 after all gates green; T013 stays open beyond this branch.

## Notes

- Never modify scripts/installer.nsh, scripts/open-with.ps1, markdownmeister.json, Formula/, updatescoop.ps1, updatebrew.ps1, updatepackagejson.ps1, or existing electron-builder.yml values (SC-003 absolute rule).
- Structural vs behavioural changes never share a commit (Tidy First).
