# Implementation Plan: Windows Store Tile Assets

**Branch**: `spec-067-windows-store-tile-assets` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/archive/067-windows-store-tile-assets/spec.md`

## Summary

Close the Microsoft Partner Center rejection by giving the Windows Store package its own branded tile assets instead of the packager's built-in sample images. The package's tile images are supplied by a directory of named PNGs under the packager's build-resources root; that directory does not exist today, so the appx target substitutes four generic sample files. This feature extends the existing single-master icon derivation to emit the appx tile set (small, medium and large square, package logo, and a non-square wide tile composed by centring the mark), places it where the appx target reads it, points the build-resources root at that tracked location, sets the tile background colour to the artwork navy, and adds a regression test proving the assets exist at the required sizes and that the derivation and configuration stay wired. It also corrects the store listing documentation so the branded listing logos are uploaded and removes the now-falsified claim that default package tiles are acceptable. No application runtime code changes and no other distribution channel changes.

## Technical Context

**Language/Version**: PowerShell 7 with `System.Drawing` for image derivation (the existing zero-dependency approach in `scripts/generate-icons.ps1`); TypeScript 5.8 strict for the Vitest regression test; YAML for `electron-builder.yml`. No application (Electron/React) source changes.

**Primary Dependencies**: None new. The derivation uses the same GDI+ bilinear/bicubic path already used for the platform icon ladder; the test reads PNG dimensions directly from the IHDR chunk with `node:fs`, so no image library is added.

**Storage**: No application storage. The derivation writes tracked PNGs under `resources/appx/`; nothing is written at runtime.

**Testing**: Vitest unit test asserting (a) `electron-builder.yml` points the build-resources root at the icon resource directory, (b) every required tile file exists in `resources/appx/` with the exact pixel dimensions the manifest surfaces need, (c) no vendor sample asset is present, and (d) `scripts/generate-icons.ps1` still names each tile output, so regeneration cannot silently drop the set. Playwright e2e is not applicable: the tile surfaces are the Store listing and the Windows shell (Start menu), neither of which is part of the application window a Playwright session drives. The full `npm run test:e2e` suite is still run before completion per AGENTS, but this feature adds no e2e spec because it adds no window behaviour.

**Target Platform**: Windows 10 build 19041+ (package installs and runs); tile assets are consumed by the Store listing and by Windows shell tile surfaces.

**Constraints**: Must not change the other channels' icons, the package identity, capabilities, shell extension, folder action, or file-association scope (spec FR-010). Must not write the master. Must not hand-edit derived assets. The build-resources repoint must not disturb the existing explicit per-platform icon paths (`win.icon`, `mac.icon`, `linux.icon`).

**Scale/Scope**: One derivation script extended, one new tracked asset directory, one packaging configuration key added, one background colour, one new unit test, targeted documentation updates.

## Constitution Check

*GATE: Passed after pre-research. No principle is engaged differently from the existing icon and packaging pipeline.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None. No renderer, preload, IPC, or main-process change. Assets are packaging inputs only. |
| II. Every Path Is Untrusted | None. No path handling changes. |
| III. Never Lose The User's Words | None. No save, dirty-state, or document behaviour changes. |
| IV. Calm, Predictable Editing | None. No runtime UI change; the only user-visible change is the tile icon drawn by Windows and the Store. |
| V. Test What Can Corrupt Or Escape | Honoured in proportion to risk. The defect is silent (a default image ships unnoticed), so a regression test asserts the branded asset set is present, correctly sized, and wired to the derivation and the packaging config, which is exactly the failure that let the default ship. |

All gates pass. No deviations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/archive/067-windows-store-tile-assets/
├── plan.md              # This file
├── research.md          # D1–D6 decisions with evidence
├── tasks.md             # Ordered, independently verifiable work items
├── spec.md              # Requirements (with the 2026-10-02 clarifications)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
scripts/
└── generate-icons.ps1          # CHANGED: also emit resources/appx tile set; wide tile composed
resources/
└── appx/                       # NEW: tracked branded appx tile PNGs
    ├── StoreLogo.png           #   50x50  (package logo)
    ├── Square44x44Logo.png     #   44x44
    ├── Square150x150Logo.png   #   150x150
    ├── LargeTile.png           #   310x310 (Square310x310Logo)
    ├── SmallTile.png           #   71x71  (Square71x71Logo)
    └── Wide310x150Logo.png     #   310x150 (centred mark, transparent background)
assets/
└── windows-store/              # MOVED: Partner Center listing art (was store-assets/)
electron-builder.yml            # CHANGED: directories.buildResources + appx.backgroundColor
docs/
├── icon-provenance.md          # CHANGED: tile set added to the derivation chain and consumers
└── store-listing.md            # CHANGED: upload branded logos; remove the default-tiles claim
package.json                    # CHANGED: new test in the format:check list
tests/main/
└── storeTileAssets.test.ts     # NEW: asset presence, dimensions, wiring
```

**Structure Decision**: The appx tile assets live under `resources/appx/` because the packager reads tile images from `<buildResources>/appx/` and the build-resources root is repointed to `resources/`, which is already the directory holding the packager's per-platform icon assets. This avoids committing generated files into the gitignored `build/` and keeps every packager-consumed asset in one tracked place. The derivation stays in `scripts/generate-icons.ps1` so the tile set inherits the spec 043 one-master rule rather than becoming a second, parallel source of icon assets. The promotional Partner Center listing art moves from the top-level `store-assets/` to `assets/windows-store/`, grouping the hand-authored source artwork under `assets/`; nothing reads the directory, so the move has no build effect.

## Complexity Tracking

No constitutional deviations. Two recorded choices a reviewer might otherwise question:

1. **The build-resources root is repointed to `resources/`.** The packager's tile lookup is hardcoded to `<buildResources>/appx/` and exposes no configuration key for it (`node_modules/app-builder-lib/out/targets/AppxTarget.js:13,83`; `out/options/AppXOptions.d.ts` has no asset-directory option). The default root is `build/`, which this repository gitignores, so the branded assets cannot live there without committing generated files into an ignored build-output directory. Repointing to `resources/` reuses the directory that already holds the packager's icon assets. The simpler alternative (commit into `build/` and un-ignore it) was rejected because it mixes generated output with tracked inputs and contradicts the script's documented rule.
2. **Six tile files are supplied, not four.** The manifest always references four tile images (the package logo, the small and medium squares, and the wide tile) and references the large and small square tiles whenever they are present (`AppxTarget.js:260-271,367-387`). Supplying the large and small squares removes the remaining default surfaces and costs only two more downscales. The alternative (four files only) would leave the 310x310 and 71x71 tile surfaces with no branded image.
