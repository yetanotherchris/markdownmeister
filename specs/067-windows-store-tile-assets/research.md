# Research: Windows Store Tile Assets

Date: 2026-10-02. Each decision states the choice, the evidence, and the rejected alternatives. Packager behaviour was verified against the installed electron-builder 26.17.0 source in `node_modules/`; the identity of the rejected asset is a direct read of that source, not an inference.

## D1: Why the package ships a default tile, and where branded tiles must go

**Decision**: Supply the tile assets in `resources/appx/` and repoint `directories.buildResources` to `resources` in `electron-builder.yml`, so the appx target reads them.

**Evidence**:

- The appx target resolves its tile assets from `<buildResources>/appx/`: `packager.getResource(undefined, "appx")` with `APPX_ASSETS_DIR_NAME = "appx"` (`node_modules/app-builder-lib/out/targets/AppxTarget.js:13,83`) and `getResource` joins the build-resources directory with the requested name (`out/platformPackager.js:585-593`).
- When that directory is absent or missing a named file, `computeUserAssets` substitutes the vendor samples: `StoreLogo.png ← SampleAppx.50x50.png`, `Square150x150Logo.png ← SampleAppx.150x150.png`, `Square44x44Logo.png ← SampleAppx.44x44.png`, `Wide310x150Logo.png ← SampleAppx.310x150.png` (`AppxTarget.js:14-19,152-158`). Those generic images are the "default image" in the rejection; the manifest paths are the same either way, so nothing in a manifest inspection would reveal the substitution.
- The default build-resources root is `build` (`electron-builder` configuration default), and this repository ignores `build/` (`.gitignore`, under "electron-vite build output"). The branded assets therefore cannot live at the default location without committing generated files into an ignored build-output directory.
- `AppXOptions` exposes no option for the asset directory (`node_modules/app-builder-lib/out/options/AppXOptions.d.ts`), so repointing the root is the only supported mechanism.

**Alternatives considered**:

- Rejected: *commit `build/appx/` and add `.gitignore` negations*. It fights the repository's own rule that `build/` is output, and the derivation script explicitly documents "do not write generated icons to build/, which is ignored by Git".
- Rejected: *a custom `appxmanifest.xml` via `customManifestPath`*. It would let us rename the manifest's tile references but the target still maps the four canonical filenames to vendor samples when the assets are missing; the assets, not the manifest, are the defect.
- Rejected: *write the tiles at build time into `build/appx/`*. The Store workflow does not run the icon derivation, and adding it there would make a reproducible artifact depend on a machine step that the direct channels do not need; committed, tracked assets keep the package reproducible from the repository alone.

## D2: Which tile files to supply

**Decision**: Supply six files in `resources/appx/`: `StoreLogo.png` (50×50), `Square44x44Logo.png` (44×44), `Square150x150Logo.png` (150×150), `LargeTile.png` (310×310), `SmallTile.png` (71×71), and `Wide310x150Logo.png` (310×150). Do not supply `BadgeLogo.png` or `SplashScreen.png`.

**Evidence**: The manifest template always references the package logo and the small/medium square and wide tiles, and conditionally adds the large and small square tiles only when the corresponding files are present (`AppxTarget.js:260-271,367-387`). `BadgeLogo.png` is used only for a lock-screen badge and `SplashScreen.png` only for a UWP splash; a full-trust desktop application shows neither, so supplying them would add assets with no surface (`AppxTarget.js:359-366,388-395`). Supplying the large and small squares removes the last default surfaces at negligible cost.

**Alternatives considered**:

- Rejected: *the minimum four files*. The 310×310 and 71×71 tiles would remain unbranded, which is the same class of defect the rejection names.
- Rejected: *also supply `BadgeLogo.png`/`SplashScreen.png`*. No Windows surface for this package consumes them; supplying them would claim surfaces the app does not use.

## D3: The non-square wide tile is a centred mark, not a stretched one

**Decision**: `Wide310x150Logo.png` is the square master scaled to fit a safe area and centred on a transparent 310×150 canvas, preserving aspect ratio. The mark is not stretched.

**Evidence**: The maintainer chose this composition during specification (spec Clarifications). The existing committed promotional listing art (`store-assets/wide-310x150.png`) fills the frame with a wide redraw; that is a marketing composition and is explicitly out of scope, so it is not the model for the package tile. Windows composites the tile image over the manifest background colour, so a transparent canvas lets the background show around the centred mark.

**Alternatives considered**:

- Rejected: *stretch the square mark to 310×150*. It distorts the mark, which the spec's edge cases make a defect.
- Rejected: *tile the square mark across the wide frame*. It reads as a repeated pattern rather than one product mark.

## D4: The tile background colour is the artwork navy

**Decision**: Set `appx.backgroundColor` to `#222540`, the modal fill colour of the master.

**Evidence**: The packager's default background is `#464646` (`out/options/AppXOptions.d.ts:8-11`), a mid grey that does not appear in the artwork. Sampling the opaque dark pixels of `assets/icon/master.png` on a 7-pixel grid gives `#222540` as the most frequent fill (1209 of the sampled dark pixels), with the nearest neighbours `#232641` and `#222641`; the mark's navy is therefore `#222540`. Painting the tile background the same navy means the centred square mark and its rounded tile edge composite as one brand-coloured tile, and the cream ring and monogram keep their contrast on both light and dark system chrome.

**Alternatives considered**:

- Rejected: *keep the default `#464646`*. It clashes with the artwork and makes the rounded tile edge read as a mismatched box.
- Rejected: *bake the navy into the wide PNG instead of setting the background*. Transparency is what lets the same wide asset sit on any surface the Shell paints; a baked background would reintroduce a hard edge.

## D5: The tile set joins the existing one-master derivation

**Decision**: Extend `scripts/generate-icons.ps1` to emit the appx tile set into `resources/appx/`, in the same run that produces the platform icons. Update `docs/icon-provenance.md` to list the tile set in the derivation chain and name its consumers.

**Evidence**: Spec 043 makes `assets/icon/master.png` the single source every derived icon traces to, with a documented regeneration step, and spec 049 keeps that pipeline. The defect exists because the tile set was never part of the pipeline at all. Adding it there makes a future logo change update the tiles automatically and keeps the "replace the master and regenerate" contract intact (spec FR-005/FR-006). The script already validates the master before deriving and never writes it, which the tile outputs inherit.

**Alternatives considered**:

- Rejected: *a separate tile-generation script*. It would create a second place to regenerate and a second thing to remember after a logo change, which is how the tile set drifted in the first place.
- Rejected: *hand-commit the tile PNGs*. It breaks the one-master rule the repository already enforces for every other icon asset.

## D6: Verification is a unit test plus the real submission

**Decision**: Add `tests/main/storeTileAssets.test.ts`, a Vitest suite that asserts the build-resources root is `resources`, every required tile file exists with the exact expected dimensions (read from the PNG IHDR, no image dependency), no vendor sample name is present, and `scripts/generate-icons.ps1` still names each tile output. The real Store listing and the certification re-submission remain manual, recorded in `docs/store-listing.md`.

**Evidence**: The tile surfaces are the Store listing and the Windows Shell; a Playwright session drives the application window, which no tile asset affects, so there is no e2e surface (spec Assumptions). The silent failure this feature fixes is "a branded asset is not wired or has the wrong size", both of which a direct file-and-config assertion catches. The PNG-dimension read mirrors the byte-level master validation already used by `generate-icons.ps1`, so it adds no dependency.

**Alternatives considered**:

- Rejected: *a Playwright e2e spec*. It cannot observe a Start-menu tile or a Store listing, so it would assert nothing about the feature.
- Rejected: *a full appx packaging test in CI*. `makeappx` and the Windows SDK are not present on the quality runner, and unpacking a package would still not prove the Store listing is correct; the file-and-config assertion covers the code-side defect, and the maintainer confirms the listing.

## References

- Spec 043 `research.md` (master artwork adoption, one-master derivation), spec 049 `research.md` (Windows frame ladder), consumed unchanged.
- Spec 062 `docs/store-listing.md` (the listing content pack this feature corrects).
- electron-builder AppX target and options: `node_modules/app-builder-lib/out/targets/AppxTarget.js`, `out/options/AppXOptions.d.ts`, `out/platformPackager.js`.
- Microsoft tile and asset guidance: `learn.microsoft.com/windows/apps/design/style/iconography/app-icon-design` and the tile asset documentation linked from the rejection.
