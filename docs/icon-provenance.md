# Icon provenance

Where the MarkdownMeister product icon comes from, how every committed asset
relates to it, and how to regenerate the set. Companion to
`specs/archive/039-product-icon/` (spec 039).

## The artwork

A minimal geometric mark: a dark navy rounded-square tile carrying a single
light "M" drawn as one continuous polyline stroke with round caps and joins.

- **Tile**: vertical linear gradient `#26314E` → `#131A2B`, inset 8.5% from the
  canvas edge, corner radius 22.5% of the canvas — proportions that survive
  macOS squircle masking and Windows square-with-transparency treatment alike.
- **Mark**: five-point polyline `(0.295,0.705) (0.295,0.335) (0.500,0.575)
  (0.705,0.335) (0.705,0.705)` in `#F9FAFC`, stroke width 7.8% of the canvas —
  an "M" whose two valleys keep it legible when rasterised at 16×16.
- **Backgrounds**: designed for light *and* dark chrome — the dark tile is
  chosen to hold contrast on light surfaces and the light stroke to stay
  legible on dark ones. Render verification on real OS surfaces is manual
  (quickstart.md checklist); transparency is true alpha throughout.

The canonical editable source is `assets/icon/master.svg`; every raster asset
is generated from the same geometry constants (mirrored in the generator
script), so no platform receives a hand-redrawn variant.

## Production route status (FR-005 deferral)

Spec 039's FR-005 directed that the artwork be produced with AI image
generation (Gemini "Nano Banana" or Grok) with a human selecting among
candidates before commit. **That route was deferred by explicit maintainer
authorization on 2026-08-23.** The artwork was instead authored directly by the
ox-alpha model as the minimal geometric mark described above, meeting FR-006
(16×16 recognisability, light/dark legibility) and FR-008 (no third-party or
protected imagery — the mark is original geometry with no reference product).

If the generation pass runs later:

1. Generate candidates with prompts along these lines, iterating on output:
   - "Minimal flat app icon, dark navy (#26314E→#131A2B gradient) rounded
     square tile on transparent background, single continuous white 'M'
     letterform drawn as one thick polyline stroke with round caps, geometric,
     calm, no text, no shadow, vector style"
   - Variants: stroke weight (6–10%), tile radius (20–25%), mark position.
2. A human selects one candidate; reject anything resembling an existing
   product logo (FR-008 review step).
3. Commit the selected candidate as `assets/icon/master.svg` + re-render the
   raster set per the derivation chain below; replace this section with the
   session record (prompts, candidates, selection).

## Derivation chain

```text
assets/icon/master.svg          canonical editable geometry (hand-maintained)
        │  identical geometry constants mirrored in the script
        ▼
scripts/generate-icon-master.ps1   zero-dependency GDI+ renderer
        ├─► assets/icon/master.png            1024×1024 RGBA lossless master
        ├─► resources/icon.ico                ICO: PNG entries 16–256 (256 stored as byte 0)
        ├─► resources/icon.icns               ICNS: chunks ic07/ic08/ic09/ic10 (128–1024)
        ├─► resources/icon.png                512×512 convenience master (runtime window icon)
        └─► resources/icons/NxN.png           ladder: 16,24,32,48,64,128,256,512
```

Consumers: electron-builder (`win.icon`, `mac.icon`, `linux.icon`), the
BrowserWindow window icon (`resources/icon.png` via extraResources), and the
Linux desktop-entry mechanism (copies what it finds inside the AppImage).
Never edit derived assets by hand; change the SVG + script constants together
and regenerate everything at once so no platform drifts (FR-007).

## Regeneration

From the repository root (PowerShell 7):

```powershell
pwsh -File scripts/generate-icon-master.ps1
```

Re-running reproduces **structurally equivalent** assets: identical dimensions,
colour types (RGBA), ICO directory shape, and ICNS chunk layout. PNG bytes may
differ between runs because GDI+ encoder output is not byte-stable;
dimensional/structural equivalence is the contract (spec SC-005), which is
exactly what the unit tests in `tests/main/iconAssets.test.ts` assert.
