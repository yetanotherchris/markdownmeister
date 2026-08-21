# Implementation Plan: Scoop Start Menu Shortcut

**Branch**: `034-start-menu-shortcut` | **Date**: 2026-08-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/034-start-menu-shortcut/spec.md`

## Summary

Scoop-installed MarkdownMeister currently puts no entry in the Start Menu; installer users get one for free. The fix is declarative: add Scoop's `shortcuts` property to `markdownmeister.json`, harden `updatescoop.ps1` so a release rewrite can never silently drop it, and lock both with a unit test. No application code changes.

## Technical Context

**Language/Version**: JSON manifest consumed by Scoop 0.5.x; PowerShell 7 release scripts

**Primary Dependencies**: None new — Scoop built-in behaviour (research R1)

**Storage**: N/A

**Testing**: Vitest (`tests/main/scoopManifest.test.ts`) + manual Scoop install/update/uninstall per [quickstart.md](quickstart.md)

**Target Platform**: Windows via Scoop; macOS/Linux and NSIS installer untouched

**Performance Goals**: N/A

**Constraints**: The declaration must survive the release-time manifest rewrite (FR-007)

**Scale/Scope**: One manifest property, one script guard, one test file, four spec artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: unchanged — no application code is touched.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None — no renderer, preload, or IPC changes |
| II. Every Path Is Untrusted | None — the app handles no new paths; the shortcut target is resolved by Scoop, outside the app |
| III. Never Lose The User's Words | None — no save-path changes |
| IV. Calm, Predictable Editing | None — no editor or UI behaviour changes |
| V. Test What Can Corrupt Or Escape | Honoured in proportion to risk: the only silent-failure mode (release rewrite dropping the declaration) gets a throwing guard plus a unit test; real install behaviour is verified manually per the spec's Assumptions |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/034-start-menu-shortcut/
├── plan.md              # This file
├── research.md          # Phase 0 output: R1–R4 decisions with evidence
├── quickstart.md        # Phase 1 output: manual verification scenarios
├── contracts/
│   └── release.md       # Phase 1 output: manifest contract + regeneration rules
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

No data-model.md: the feature introduces no application data entities; the manifest shape lives in contracts/release.md.

### Source Code (repository root)

```text
markdownmeister.json            # Add "shortcuts" declaration (FR-001–004)
updatescoop.ps1                 # Throw if loaded manifest lacks "shortcuts" (FR-007)
tests/main/scoopManifest.test.ts  # Manifest shape assertions (FR-001–004)
```

**Structure Decision**: Packaging-only change following the spec 005/009 pattern — package definitions live at the repository root, are rewritten by root-level update scripts at release time, and their testable shape is covered under `tests/main/` (node environment), where `check-maintainability.test.ts` already tests a non-app script.

## Complexity Tracking

Not applicable — no constitution violations.
