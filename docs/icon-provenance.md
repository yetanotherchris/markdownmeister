# Icon provenance

Where the MarkdownMeister product icon comes from, how every committed asset relates to it, and how to regenerate the set. Companion to `specs/archive/043-new-logo/` (spec 043); the asset formats and consumers were established by spec 039.

## The artwork

A dark navy rounded-square tile with a cream border ring, carrying a cream "M" monogram drawn as a continuous stroke. Designed to hold contrast on light and dark system surfaces alike; transparency is true alpha throughout. Render verification on real OS surfaces is manual (quickstart.md checklist).

The master is `assets/icon/master.png`, committed verbatim at its native 1254×1254 (square, 8-bit RGBA, lossless). There is no vector source; the raster is canonical.

## Adoption record

The artwork was supplied by the maintainer as `new-logo.png` and adopted verbatim as the master on 2026-08-24 (spec 043), replacing the previous minimal-geometry mark and its SVG-based derivation. The maintainer selected the artwork; no generation or candidate-selection step remains in scope. The earlier deferral record for an AI-generation session (spec 039 FR-005) is closed by this adoption.

## Derivation chain

```text
assets/icon/master.png            canonical artwork (maintainer-supplied, committed verbatim)
        │  high-quality bicubic downsampling
        ▼
scripts/generate-icons.ps1        zero-dependency GDI+ derivation
        ├─► resources/icons/NxN.png           ladder: 16,20,24,32,40,48,64,96,128,256,512
        ├─► resources/icon.png                512×512 convenience master (Linux runtime window icon)
        ├─► resources/icon.ico                ICO: PNG frames 16–256 (256 stored as byte 0)
        └─► resources/icon.icns               ICNS: ic07/ic08/ic09/ic10 (128/256/512 ladder
                                              entries; ic10 a true 1024×1024 downsample)
docs/site/assets/icon.png         byte copy of the 256 ladder entry (website icon)
```

Consumers: electron-builder (`win.icon`, `mac.icon`, `linux.icon`), the BrowserWindow window icon (on Windows the multi-size `resources/icon.ico` shipped via extraResources; on Linux the `resources/icon.png` copy), the Linux desktop-entry mechanism (copies what it finds inside the AppImage), and the website asset copy. Never edit derived assets by hand; replace `assets/icon/master.png` and regenerate everything at once so no platform drifts (FR-004).

The script validates the master before deriving (square, at least 1024×1024, 8-bit RGBA, parsed from raw bytes) and never writes the master itself.

## The Windows frame ladder

The .ico embeds one frame per size from 16 through 256 with no gaps: 16, 20, 24, 32, 40, 48, 64, 96, 128, and 256. Every frame is a byte copy of its committed ladder entry in `resources/icons/`, which is what the structural tests assert. Spec 049 added the 20, 40, and 96 intermediates because Windows shells request those exact sizes: taskbar and Alt-Tab imagery scales with display DPI, so common fractional settings such as 125% and 150% land between the old ladder points, and Explorer's large-icons view asks for 96 directly. When a requested size falls between available frames the shell picks a smaller frame and stretches it upward, which is the pixelation this ladder removes.

The resampling procedure itself did not change in spec 049: every size still derives from the master in a single high-quality bicubic draw, applied identically to all sizes.

## Regeneration

From the repository root (PowerShell 7):

```powershell
pwsh -File scripts/generate-icons.ps1
```

Then refresh the website copy:

```powershell
Copy-Item resources/icons/256x256.png docs/site/assets/icon.png
```

Re-running reproduces **structurally equivalent** assets: identical dimensions, colour types (RGBA), ICO directory shape, and ICNS chunk layout. PNG bytes may differ between runs because GDI+ encoder output is not byte-stable; dimensional/structural equivalence is the contract (spec 039 SC-005), which is exactly what the unit tests in `tests/main/iconAssets.test.ts` assert.
