# Tasks: Scoop Start Menu Shortcut

**Input**: Design documents from `/specs/034-start-menu-shortcut/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/release.md, quickstart.md

**Tests**: Included where the repository can run them (manifest shape). Real Scoop install/update/uninstall behaviour cannot run in CI (ubuntu runners, research R4) and is verified manually per quickstart.md.

**Organization**: By user story. There is no setup or foundational phase — the feature has no project initialization and no blocking prerequisites; the manifest declaration itself is User Story 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 — Launch MarkdownMeister from the Start Menu (Priority: P1) 🎯 MVP

**Goal**: Installing via Scoop produces a Start Menu entry named "MarkdownMeister" that launches the editor with the application icon.

**Independent Test**: `npm test` proves the declaration exists and is shaped correctly; on Windows, quickstart Scenario 1 proves the entry appears and launches.

### Tests for User Story 1

> **NOTE: Write these FIRST and confirm they FAIL before implementing**

- [x] T001 [P] [US1] Write failing shape assertions in tests/main/scoopManifest.test.ts: the committed markdownmeister.json parses, declares exactly one entry in `shortcuts`, whose target is `markdownmeister.exe` and display name is `MarkdownMeister`, with no arguments or icon element (contracts/release.md)

### Implementation for User Story 1

- [x] T002 [US1] Add `"shortcuts": [["markdownmeister.exe", "MarkdownMeister"]]` to markdownmeister.json so T001 passes (FR-001–FR-004)

**Checkpoint**: `npm test` green. On a Windows machine with the bucket registered, quickstart Scenario 1 passes against the next published build.

---

## Phase 2: User Story 2 — Shortcut stays correct across updates and removal (Priority: P2)

**Goal**: Updating keeps the Start Menu entry working against the new version; uninstalling removes it.

**Independent Test**: Quickstart Scenarios 2 and 3 on a real Windows machine.

### Implementation for User Story 2

No code — creation on update and removal on uninstall are Scoop built-in behaviour once the declaration exists (research R1).

- [ ] T003 [US2] After the next tagged release is published, run quickstart Scenarios 2 (update from a pre-feature install keeps a working entry) and 3 (uninstall leaves no entry), recording outcomes in the release notes or follow-up issue

**Checkpoint**: Entry survives an update and disappears on uninstall on a real installation.

---

## Phase 3: User Story 3 — Releases keep the shortcut declaration (Priority: P3)

**Goal**: The release-time rewrite of markdownmeister.json preserves the `shortcuts` declaration, and fails loudly rather than silently dropping it.

**Independent Test**: Quickstart Scenario 4 against a scratch clone with a dummy artifact.

### Implementation for User Story 3

- [x] T004 [US3] In updatescoop.ps1, after loading the manifest and before writing, throw a descriptive error if `$manifest.shortcuts` is absent (FR-007, research R3)
- [x] T005 [US3] Run quickstart Scenario 4 in a scratch clone: dummy `9.9.9` artifact through ./updatescoop.ps1 changes only version/url/hash and keeps `shortcuts`; deleting `shortcuts` first makes the script throw without writing

**Checkpoint**: Release automation cannot publish a definition that lost the declaration.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Repository gates and spec lifecycle.

- [x] T006 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`; all four must pass (e2e covers regression only — the feature itself is outside the app, per spec Assumptions)
- [x] T007 As part of the implementation PR, archive the spec: `git mv specs/034-start-menu-shortcut specs/archive/034-start-menu-shortcut` and set its **Status** to `Archived`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: No prerequisites — starts immediately; T001 (test) precedes T002 (declaration)
- **Phase 2 (US2)**: Depends on Phase 1 being released; T003 is post-release verification
- **Phase 3 (US3)**: Independent of Phases 1–2 code-wise; T005 uses the declaration from T002, so run after Phase 1
- **Phase 4 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Fully independent; delivers the MVP alone
- **US2 (P2)**: Reuses US1's declaration; adds only verification
- **US3 (P3)**: Guards US1's declaration against release-time loss

### Parallel Opportunities

- T001 can be written in parallel with nothing else blocking it; T004 is file-independent of T001/T002 and may proceed alongside Phase 1

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → confirm failure → T002 → confirm pass
2. Run the four quality gates
3. The MVP is complete: the next release carries the declaration, and every Scoop user gets the Start Menu entry on install or update

### Incremental Delivery

1. Phase 1 ships the user-visible value
2. Phase 3 hardens it against release-time regression before the next tag
3. Phase 2 closes the loop with real-world verification after publication

---

## Notes

- T001 must fail before T002 lands (red → green)
- T003 and T005 are manual by nature; record evidence rather than claiming unverified success
- Commit after each task or logical group
