# Implementation Plan: About Section Alignment

**Branch**: `spec-046-about-row-alignment` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/046-about-row-alignment/spec.md`

## Summary

A one-declaration CSS correction: the About area's row padding drops its 8 px horizontal component so the Version, Repository URL, and Revision rows line up with the "About" heading. No markup, behaviour, or other-area styling changes.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (renderer stylesheet only)

**Primary Dependencies**: None.

**Storage**: None.

**Testing**: Existing About e2e suite remains green; one added computed-style assertion pins the alignment contract.

**Target Platform**: All desktop platforms (identical CSS).

**Performance Goals / Constraints / Scale/Scope**: N/A; single rule edit plus a test assertion.

## Constitution Check

*GATE: trivial presentation change.*

| Principle | Impact |
|-----------|--------|
| I / II | None - no process, IPC, or path surface touched |
| III | None - no document or save behaviour involved |
| IV | Honoured - quiet visual correction; no interaction changes |
| V | N/A beyond keeping the existing suite green |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/046-about-row-alignment/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
└── research.md    # R1-R3 with evidence
```

### Source Code (repository root)

```text
src/renderer/chrome/settings.css   # EDIT: .settings-about-row padding 6px 8px -> 6px 0
tests/e2e/about.spec.ts            # EDIT: assert computed left/right padding of rows is 0px
package.json                       # EDIT: append settings.css/tests path if not already listed in scripts.format:check
```

**Structure Decision**: Minimal diff; no new files.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Single-rule change**: `.settings-about-row` loses only the horizontal padding component; vertical spacing stays for comfortable rhythm.
- **D2 Scope isolation**: the shared 6 px/8 px pattern on radio/select/switch controls is untouched (hit-target comfort there is intentional).
- **D3 Computed-style assertion over screenshots**: stable across platforms and themes, and sufficient for FR-001.

## Complexity Tracking

> No constitution violations. Nothing further to note.
