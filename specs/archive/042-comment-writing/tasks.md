# Tasks: Comment Writing Standards

**Input**: Design documents from `/specs/042-comment-writing/`

**Prerequisites**: plan.md and spec.md

## Phase 1: Guidance

- [x] T001 [US1] Add the comment-writing rules required by FR-001 through FR-004 to `AGENTS.md` and remove em dashes from that file.

## Phase 2: Comment Cleanup

- [x] T002 [US2] Simplify or remove AI-filler and history comments in `tests/main/channelIsolation.test.ts` and `tests/main/scoopManifest.test.ts`.
- [x] T003 [P] [US2] Simplify or remove rhetoric and unsupported platform-internal claims in `src/`, `scripts/`, `.github/`, `native/`, and root configuration comments.
- [x] T004 [P] [US2] Simplify or remove rhetoric, review history, and ceremonial emphasis in the remaining `tests/` comments.

## Phase 3: Verification

- [x] T005 [US2] Search the in-scope authored comments for em dashes and ceremonial all-caps emphasis, then inspect remaining safety comments for FR-006 compliance.
- [x] T006 [US2] Run `npm run lint`, `npm run typecheck`, and `npm run test`.
