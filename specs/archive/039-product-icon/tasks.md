# Tasks: Product Icon

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

## 1. Planning artifacts and provenance

- [ ] 1.1 Write `plan.md`, `research.md` (D1–D7 with node_modules evidence), `quickstart.md` (manual visual checklist), `tasks.md`; record the FR-005 deferral in plan.md Complexity Tracking (maintainer authorization 2026-08-23)
- [ ] 1.2 Write `docs/icon-provenance.md`: artwork description, derivation chain, regeneration command, deferred AI-generation route
- [ ] 1.3 Commit `docs(039)` planning artifacts + provenance

## 2. Packaging wiring

- [ ] 2.1 `electron-builder.yml`: add `win.icon: resources/icon.ico`, `mac.icon: resources/icon.icns`, `linux.icon: resources/icons` under the existing platform blocks; add an `extraResources` entry shipping `resources/icon.png` for the runtime window icon; change no existing key values (FR-002, FR-003; research D1–D3)
- [ ] 2.2 Commit `feat(039)` packaging wiring

## 3. Runtime window icon

- [ ] 3.1 `src/main/index.ts`: set the BrowserWindow `icon` option on win32/linux, resolving `resources/icon.png` relative to `__dirname`; leave macOS to the bundle icns (research D3)
- [ ] 3.2 Commit `feat(039)` window icon

## 4. Tests

- [ ] 4.1 `tests/main/iconAssets.test.ts` (NEW): pure-TS structural parsing of committed binaries — PNG IHDR ladder (exists, width/height, colour type 6), master.png exactly 1024×1024 RGBA; ICO header reserved=0/type=1/count=7, entries 16–256 with sane offsets/sizes and 256 encoded as dimension byte 0; ICNS magic/total-length/file-size match, chunks exactly ic07/ic08/ic09/ic10 with consistent lengths (FR-001, FR-002, FR-007; research D6)
- [ ] 4.2 `tests/main/linuxDesktopEntry.test.ts` (EXTEND): icon-found install path against the electron-builder AppImage layout from research D2 (hicolor ladder + root icon + `.DirIcon`)
- [ ] 4.3 `tests/e2e/product-icon.spec.ts`: DROPPED — `BrowserWindow.getIcon()` does not exist in Electron 43 (verified against electron.d.ts); window-icon rendering stays manual per quickstart.md (research D7)
- [ ] 4.4 Append new/edited test files to the `format:check` list in package.json
- [ ] 4.5 Commit `test(039)`

## 5. Gates

- [ ] 5.1 `npm run lint`, `npm run typecheck`, `npm test`, `npm run check`, prettier --check on touched files — all green in order
- [ ] 5.2 `npm run test:e2e` green last (retry apparent contention up to 3 times)

## 6. Archive

- [ ] 6.1 `git mv specs/039-product-icon specs/archive/039-product-icon`; set spec Status to Archived; commit `docs(specs)`
