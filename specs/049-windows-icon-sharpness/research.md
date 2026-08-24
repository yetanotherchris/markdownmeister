# Research: Sharp Windows Application Icon

Date: 2026-08-24. Every claim verified against this worktree during planning; the committed icon containers were parsed byte-level during research.

## R1 - What the committed Windows icon contains today

**Decision**: Extend the embedded frame set; today's ladder has gaps exactly where Windows requests intermediate sizes.

**Evidence**: `resources/icon.ico` (82,362 bytes) parses as an ICONDIR with 7 PNG-encoded frames: 16, 24, 32, 48, 64, 128, 256. There is no 512 frame and, critically, no 20, 40, or 96 frame. The sizes come from `$IcoSizes = @(16, 24, 32, 48, 64, 128, 256)` (`scripts/generate-icons.ps1:27`), while the PNG ladder writes `@(16, 24, 32, 48, 64, 128, 256, 512)` (:26). Frame payloads are byte-identical to the corresponding ladder files (`tests/main/iconAssets.test.ts:163-170`). Windows shells request sizes that vary by surface and DPI (taskbar and Alt-Tab scale with DPI; Explorer's large-icons view uses 96; medium icons 48); when a requested size falls between available frames the shell picks a smaller one and stretches it, which is the classic pixelation mechanism. Missing 20/40/96 maps directly onto common fractional-DPI requests (125%/150% scaling).

## R2 - The runtime window icon bypasses the multi-size resource

**Decision**: On Windows, hand Electron the multi-size icon file instead of one large PNG.

**Evidence**: `src/main/windowIcon.ts:9-11` returns `<resourcesPath>/icon.png` when packaged (the extraResources copy of the single 512x512 image, `electron-builder.yml:30-34`) or the repo's `resources/icon.png` in dev; the BrowserWindow consumes it at `src/main/index.ts:45-50`. A lone bitmap forces per-surface scaling by the OS/Chromium for title bar (about 16 px) and taskbar imagery. The `.ico` itself reaches Windows surfaces only via exe embedding (`win.icon: resources/icon.ico`, `electron-builder.yml:38`, applied by rcedit at package time); NSIS shortcuts point at the executable's icon (`scripts/installer.nsh:41`). Serving the container lets each consumer pick a native-size frame.

**Alternatives considered**: pre-rendering many window-icon PNGs and swapping by DPI - fragile, duplicates what sized frames provide natively. Rejected.

## R3 - Derivation quality: keep the uniform bicubic draw

**Decision**: Do not change resampling in this pass; fix coverage and serving first.

**Evidence**: Every frame derives from the 1254x1254 master in a single GDI+ draw with HighQualityBicubic (`scripts/generate-icons.ps1:71-86`; constants :26-33). Spec 043 deliberately kept this and rejected adding sharp/lib dependencies ("no quality gain" claim unproven either way, archive `043-new-logo/research.md` D2), and its spec forbids per-size retouching. A halving-chain or sharpening stage might improve tiny sizes, but any perceptual gain is unverifiable automatically and risks scope creep; the structural defect (missing frames) fully explains upscaling pixelation.

**Alternatives considered**: multi-step downscale chain for small sizes - deferred as a possible follow-up only if the manual matrix still shows softness after the coverage fix; recorded honestly as unresolved-perceptual, not settled.

## R4 - Structural test coupling to preserve

**Decision**: Extend both size lists together so the existing payload-identity invariant keeps holding.

**Evidence**: The test suite asserts seven frames (:125), exact directory fields (:130-140), PNG payloads matching IHDR (:142-157), and byte identity between ico frames and `resources/icons/<N>x<N>.png` (:163-170). If the ico gained sizes absent from the ladder directory, that last invariant would need weakening. Extending `$LadderSizes` identically keeps every assertion meaningful; the Linux side consumes the same directory (`linux.icon: resources/icons`, `electron-builder.yml:89`) where extra sizes are harmless additions satisfying FR-006 (coverage superset, nothing removed). macOS chunks are independent (`$IcnsChunks` ic07..ic10 = 128/256/512/1024, :28-33) and untouched.

## R5 - Packaging wiring for FR-003

**Decision**: Ship the .ico as an extraResource so the packaged app can load it at runtime on Windows.

**Evidence**: Today only `icon.png` ships (`electron-builder.yml:30-34`); the .ico exists in-repo but not inside packages. Adding it to extraResources plus pointing `windowIconPath` at it on win32 (packaged) and at the repo copy (dev) completes the chain; darwin stays undefined (`windowIcon.ts:9`). `tests/main/windowIcon.test.ts` covers path selection and needs the win32 expectation updated.

## References

- Generator: `scripts/generate-icons.ps1:26-33, 71-86, 108-140`
- Parsed containers: `resources/icon.ico` (7 frames, max 256), `resources/icon.icns` (ic07/ic08/ic09/ic10)
- Runtime icon: `src/main/windowIcon.ts:9-11`, `src/main/index.ts:45-50`
- Packaging: `electron-builder.yml:30-34, 36-43, 87-92`; `scripts/installer.nsh:41`
- Structural tests: `tests/main/iconAssets.test.ts:125-170`
- Provenance: `docs/icon-provenance.md`
