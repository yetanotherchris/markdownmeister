# Implementation Plan: New Product Logo

**Branch**: `phase-43-new-logo`

**Spec**: `specs/043-new-logo/spec.md`

## Summary

Replace the product mark by adopting the maintainer-supplied raster artwork (`new-logo.png`, 1254×1254 RGBA) as the committed master, converting the icon derivation pipeline from "render SVG geometry" to "derive platform assets from the raster master", regenerating every derived asset, and updating tests and provenance documentation.

The existing icon infrastructure from spec 039 is reused end to end: the same output set (Windows ICO, macOS ICNS, Linux PNG ladder, window icon, website icon), the same consumers (electron-builder, BrowserWindow, Linux desktop entry, site), and the same structural unit tests. Only the source of the artwork and the first stage of the derivation change.

## Technical Approach

### Current pipeline (spec 039)

```text
assets/icon/master.svg (hand-edited geometry)
        │  geometry constants mirrored in the script
        ▼
scripts/generate-icon-master.ps1 (GDI+ renderer)
        ├─► assets/icon/master.png            1024×1024 rendered master
        ├─► resources/icons/NxN.png           ladder: 16,24,32,48,64,128,256,512
        ├─► resources/icon.png                copy of the 512 ladder entry
        ├─► resources/icon.ico                PNG entries 16–256
        └─► resources/icon.icns               ic07/ic08/ic09/ic10 = 128/256/512/1024
```

### New pipeline (this feature)

```text
assets/icon/master.png (the provided new-logo.png artwork, committed verbatim)
        │
        ▼
scripts/generate-icons.ps1 (GDI+ raster derivation)
        ├─► resources/icons/NxN.png           ladder: 16,24,32,48,64,128,256,512 (bicubic downsamples)
        ├─► resources/icon.png                copy of the 512 ladder entry (runtime window icon)
        ├─► resources/icon.ico                PNG entries 16–256 (256 stored as byte 0)
        └─► resources/icon.icns               ic07/ic08/ic09 = 128/256/512 ladder entries,
                                              ic10 = true 1024×1024 downsample of the master
docs/site/assets/icon.png             byte copy of the 256 ladder entry (website icon)
```

Changes by area:

1. **Master adoption**: copy the provided artwork over `assets/icon/master.png` unchanged (1254×1254, 32-bit RGBA, square, lossless). Delete `assets/icon/master.svg`; the raster master is now canonical and no hand-maintained geometry source exists. Git history preserves the old artwork.
2. **Generator script**: rewrite `scripts/generate-icon-master.ps1` as `scripts/generate-icons.ps1`. It no longer draws anything: it loads `assets/icon/master.png`, verifies it is a square RGBA PNG of at least 1024×1024, then produces the ladder by high-quality bicubic downsampling and packs ICO/ICNS exactly as before (same binary layouts, same size sets). The ICNS `ic10` entry becomes a 1024×1024 downsample of the master instead of a verbatim copy, because the master's native size is 1254×1254 and `ic10` is nominally 1024×1024. The script no longer writes `assets/icon/master.png`; the master is input, not output.
3. **Derived assets**: regenerate by running the new script; re-copy the 256 ladder entry to `docs/site/assets/icon.png`.
4. **Tests** (`tests/main/iconAssets.test.ts`):
   - Master block: assert the adopted size (1254×1254, 8-bit RGBA) instead of exactly 1024×1024.
   - ICNS block: drop the "ic10 equals master.png bytes" test (no longer true by design); the structural per-chunk dimension checks stay.
   - Geometry-parity block (SVG ↔ script constants): deleted with `master.svg`.
   - Everything else (ladder structure, ICO directory/payload byte-identity with the ladder, ICNS chunk layout, window icon byte-identity with the 512 entry) stays unchanged.
5. **Documentation**: rewrite `docs/icon-provenance.md` for the new artwork and raster derivation chain, replacing the old artwork description and the deferred-generation record with the adoption record (FR-007). Update the site README's icon line to cite the new spec.

### What deliberately does not change

- electron-builder configuration, `windowIcon.ts`, the Linux desktop-entry mechanism, and the site HTML: all consume the same file paths, which keep their names and formats.
- The ICO/ICNS binary layouts and ladder size sets (spec 039 FR-002 coverage).
- No new dependencies: derivation stays GDI+ via `System.Drawing`, zero external tools.

## Constitution check

- Principle I (process isolation): untouched; no renderer or IPC changes.
- Principle II (path safety): untouched; no path-handling changes. The generator script reads only repo-relative asset paths.
- Principle III (never lose the user's words): untouched; no document I/O changes.
- Principle V (test what can corrupt or escape): the icon structural tests are kept and updated in the same change as the assets they guard; no test is deleted to get green (the two removed blocks test a source format that no longer exists).

## Complexity Tracking

No deviations from the constitution. The one notable simplification: retiring `master.svg` removes an entire class of sync risk (geometry constants mirrored between SVG and script) rather than adding complexity.
