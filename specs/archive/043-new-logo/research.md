# Research: New Product Logo

This feature replaces artwork inside an existing, tested pipeline. Decisions here cover only the adoption route and the derivation change; the output formats, size sets, and consumers were settled by spec 039 and are unchanged.

## D1: Adopt the raster as the master; retire the SVG source

**Decision**: The provided `new-logo.png` (1254×1254, 32-bit RGBA, verified with `System.Drawing` on 2026-08-24: square, 8-bit-per-channel truecolour with alpha) is committed verbatim as `assets/icon/master.png`. `assets/icon/master.svg` is deleted.

**Evidence**: The supplied artwork exists only as a raster image. Redrawing it as SVG would be a hand-approximation, which spec 039's edge cases explicitly rule out ("no platform receives an upscaled, cropped, or hand-redrawn approximation"). The master contract (square, lossless, ≥1024×1024, transparency) is met at native size.

**Rejected alternative**: Auto-tracing the PNG to a new SVG to preserve an "editable source". Rejected because tracing introduces its own approximation, adds a tool dependency for no consumer benefit (no surface consumes SVG), and the raster master plus a deterministic derivation script already satisfies reproducibility (FR-004).

## D2: The generator becomes a raster derivation tool, renamed

**Decision**: Rewrite `scripts/generate-icon-master.ps1` as `scripts/generate-icons.ps1`. New behaviour: load `assets/icon/master.png`, assert square RGBA ≥1024×1024, downsample to the ladder sizes with `InterpolationMode.HighQualityBicubic` (unchanged from the old `Resize-Master`), and pack ICO (PNG entries 16–256) and ICNS (ic07/ic08/ic09/ic10) with the existing binary writers, byte-for-byte the same layout code.

**Evidence**: The old script's drawing stage (geometry constants, `New-MasterBitmap`) exists only to render `master.svg`; with a raster master that stage is dead weight. The resize and container-packing stages are artwork-agnostic and carry over unchanged. Verified by reading `scripts/generate-icon-master.ps1` (2026-08-24): `Write-Ico` and `Write-Icns` take a size→PNG-bytes map and are independent of how the map was produced.

**Rejected alternatives**:
- Keep the old name. Rejected: "generate-icon-master" describes generating the master, which is no longer what it does; the name would lie to the next reader.
- Switch to an image library (sharp, etc.) for resampling. Rejected: new dependency for no quality gain; the constitution prefers existing platform capabilities, and GDI+ bicubic is already the committed, tested route.

## D3: ICNS ic10 must downsample; the verbatim-master test is retired by design

**Decision**: `ic10` carries a true 1024×1024 downsample of the 1254×1254 master. The unit test "carries the committed master artwork verbatim as its largest chunk body" is removed and replaced by nothing beyond the existing structural check (ic10 parses as a 1024×1024 RGBA PNG).

**Evidence**: The ICNS chunk types fix nominal pixel sizes (ic07=128, ic08=256, ic09=512, ic10=1024); the existing test asserts `ihdr.width === 1024` for ic10, which a verbatim 1254×1254 payload would fail. Under spec 039 the master happened to be exactly 1024 so verbatim copy worked; with a 1254 master the correct behaviour is a downsample. This is a deliberate contract change recorded here and in the spec (FR-001 commits the master at native size; FR-002 requires correct per-size derivation), not a test weakened to pass.

## D4: Test updates stay minimal and structural

**Decision**: In `tests/main/iconAssets.test.ts`: (a) master block asserts 1254×1254 8-bit RGBA; (b) ic10 verbatim test removed (D3); (c) SVG↔script geometry-parity describe block deleted with its subject; everything else untouched.

**Evidence**: The remaining tests (ladder IHDR structure, ICO directory layout, ICO payload byte-identity with ladder files, ICNS chunk layout, window icon byte-identity with the 512 ladder entry) are artwork-agnostic and continue to guard the derivation chain after regeneration. The deleted blocks test the retired SVG source, not the shipped assets.

## D5: Website icon refresh is a byte copy

**Decision**: After regeneration, copy `resources/icons/256x256.png` to `docs/site/assets/icon.png`, matching the documented site contract ("copied unchanged from resources/icons/256x256.png"); update the README's parenthetical to cite this spec.

**Evidence**: `docs/site/README.md` file table records the copy relationship; `tests/main/siteContract.test.ts` asserts the site references `icon.png` by path (not pixels), so no site test changes.

## D6: Provenance record rewrite

**Decision**: `docs/icon-provenance.md` is rewritten: new artwork description (navy rounded tile, cream border ring, cream "M" monogram), adoption record (supplied by the maintainer as `new-logo.png`, adopted 2026-08-24, replacing both the old mark and the deferred AI-generation record), and the new derivation chain with the renamed script.

**Evidence**: The current file's "Production route status" section explicitly anticipates replacement ("replace this section with the session record"); the maintainer-supplied artwork is the resolution of that deferral (spec 043 clarification, 2026-08-24).

## Verification notes

- Regeneration must be idempotent in structure: re-running the script reproduces identical dimensions, colour types, ICO directory shape, ICNS chunk layout; PNG bytes may differ between runs (GDI+ encoder is not byte-stable), which the structural tests accommodate.
- Small-size legibility (16/24 px with the new border ring) is a manual check against the generated ladder per spec SC-003; the derivation cannot be tuned per size without violating "no hand-retouched approximations".
