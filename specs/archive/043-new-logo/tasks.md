# Tasks: New Product Logo

**Branch**: `phase-43-new-logo`

**Spec**: `specs/043-new-logo/spec.md`

## 1. Master adoption

- [x] 1.1 Commit the provided artwork verbatim as `assets/icon/master.png` (1254×1254 RGBA, byte-identical to the supplied `new-logo.png`) and delete `assets/icon/master.svg` (FR-001, research D1)

## 2. Derivation pipeline

- [x] 2.1 Rewrite the generator as `scripts/generate-icons.ps1`: load `assets/icon/master.png`, assert square RGBA ≥1024×1024, bicubic-downsample to the ladder sizes, pack ICO (16–256) and ICNS (ic07–ic10 with ic10 a 1024 downsample) using the existing binary layouts; remove the SVG-drawing stage and the master-output stage (FR-004, research D2, D3)
- [x] 2.2 Delete `scripts/generate-icon-master.ps1` after the replacement exists
- [x] 2.3 Run the new script and commit the regenerated set: `resources/icons/{16,24,32,48,64,128,256,512}.png`, `resources/icon.png`, `resources/icon.ico`, `resources/icon.icns` (FR-002)

## 3. Website icon

- [x] 3.1 Copy `resources/icons/256x256.png` to `docs/site/assets/icon.png` and update the site README's icon line to cite spec 043 (FR-006, research D5)

## 4. Tests

- [x] 4.1 Update `tests/main/iconAssets.test.ts`: master block asserts 1254×1254 8-bit RGBA; remove the ic10-verbatim test; delete the SVG↔script geometry-parity block (research D3, D4)

## 5. Documentation

- [x] 5.1 Rewrite `docs/icon-provenance.md` for the new artwork, the raster derivation chain, and the adoption record (FR-007, research D6)

## 6. Verification

- [x] 6.1 Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`; all green
- [x] 6.2 Manual checks per quickstart: ladder small sizes legible, transparency clean on light/dark, no surface still shows the old mark (SC-001..SC-006)

## 7. Finalisation

- [x] 7.1 Archive the spec to `specs/archive/043-new-logo/` with Status: Archived as part of the implementation PR
