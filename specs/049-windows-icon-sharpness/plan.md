# Implementation Plan: Sharp Windows Application Icon

**Branch**: `spec-049-windows-icon-sharpness` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/049-windows-icon-sharpness/spec.md`

## Summary

The pixelation complaint is a coverage and serving problem: the embedded Windows icon carries only 7 frames (16 through 256, no intermediates), so fractional-DPI shell requests stretch smaller frames, and the running window hands the OS one 512 px bitmap to scale for every surface. The fix completes the frame ladder (adding 20, 40, 96, and shipping the full set in both ladder and container), ships the multi-size container inside packages and points the window at it on Windows, and extends structural tests plus provenance docs. Resampling stays as spec 043 left it; no artwork or dependency changes.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (main-process path selection); PowerShell 7 generator script; electron-builder packaging config.

**Primary Dependencies**: None new. GDI+ via System.Drawing remains the resampler.

**Storage**: Regenerated binary assets committed to the repo (`resources/icon.ico`, `resources/icons/*`, `resources/icon.png`, `resources/icon.icns` unchanged in chunk rules).

**Testing**: Structural vitest suite extended for the new frame list and identity invariants; window-icon path unit tests updated; manual DPI matrix documented in the PR (SC-001) since shell rendering cannot be asserted in CI.

**Target Platform**: Windows behaviour changes; macOS/Linux artifacts regenerated but rule-identical.

**Performance Goals / Constraints**: Binary size grows modestly (three added frames, tens of KB). Constraint: FR-004 uniform derivation; FR-006 no coverage reduction elsewhere.

**Scale/Scope**: One script edit, two config edits, one main-module edit, test updates, doc update, asset regeneration. No application logic beyond icon path selection.

## Constitution Check

*GATE: packaging/assets change with a small main-process touch.*

| Principle | Impact |
|-----------|--------|
| I / II | Untouched - windowIconPath selects a resource path only; no new IPC, no renderer exposure |
| III | None - no document/save surface involved |
| IV | Honoured - crisper system-level presentation; nothing about in-app interaction changes |
| V | Honoured - the frame-coverage contract becomes an automated structural assertion so the defect class cannot silently return |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/049-windows-icon-sharpness/
├── spec.md        # WHAT/WHY
├── plan.md        # This file
└── research.md    # R1-R5 with parsed-byte evidence
```

### Source Code (repository root)

```text
scripts/generate-icons.ps1        # EDIT: $IcoSizes and $LadderSizes gain 20, 40, 96
resources/icon.ico                # REGENERATE: 10 frames, 16..256 complete
resources/icons/*.png             # REGENERATE: ladder gains 20x20, 40x40, 96x96
resources/icon.png                # REGENERATE (512 copy, unchanged rule)
electron-builder.yml              # EDIT: extraResources ships resources/icon.ico
src/main/windowIcon.ts            # EDIT: win32 returns the .ico (packaged + dev)
tests/main/iconAssets.test.ts     # EDIT: frame count/list expectations; identity invariant intact
tests/main/windowIcon.test.ts     # EDIT: win32 expectations point at .ico
docs/icon-provenance.md           # EDIT: document the extended ladder and rationale
package.json                      # EDIT: append touched files to scripts.format:check
```

**Structure Decision**: Follows spec 043's layout exactly (script generates, repo commits binaries, structural tests guard them); the only runtime change is which file the window icon path returns.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Complete the ladder everywhere**: extend `$LadderSizes` and `$IcoSizes` together to `@(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)` (ico drops nothing; ladder keeps 512). Keeping both lists identical preserves the payload byte-identity test (:163-170) and gives Linux harmless extra entries (FR-006 superset).
- **D2 Serve frames from the window**: `windowIconPath` returns `icon.ico` on win32 (extraResources copy when packaged, repo file in dev); darwin undefined and linux PNG unchanged.
- **D3 Resampling unchanged this pass**: single HighQualityBicubic draw stays; a halving chain/sharpening is deferred unless the SC-001 matrix still shows softness, keeping this change verifiable and scope-clean (research R3).
- **D4 Coverage as a build gate**: the structural test asserts exactly the FR-002 list, making regression a build failure rather than a future visual surprise.

## Complexity Tracking

> No constitution violations. Deferred item recorded honestly: possible small-size resampling improvement (D3) is intentionally not decided here; it requires the manual DPI matrix outcome from SC-001 before any re-decision, per the evidence-first practice.
