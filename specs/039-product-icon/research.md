# Research: Product Icon

**Date**: 2026-08-23 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Each decision records the evidence source. The master artwork and every derived
asset already exist on this branch (commit 5c2d35a, produced by
`scripts/generate-icon-master.ps1`); this research covers only the wiring,
verification, and provenance work.

## D1 — electron-builder icon keys and accepted forms

**Decision**: set `win.icon: resources/icon.ico`, `mac.icon: resources/icon.icns`,
`linux.icon: resources/icons` (directory form). Additive only; no existing key changes.

**Evidence** (`node_modules/app-builder-lib/out`, v26.15.3):

- `WinPackager.js:31` — `getIconPath()` = `getOrConvertIcon("ico")`;
  `platformPackager.js:670 resolveIcon` → `util/iconConverter.js doConvertIcon`:
  a configured path ending in `.ico` is returned directly after a header check
  that requires a max entry of at least 256×256 (`ERR_ICON_TOO_SMALL` otherwise).
  Our ICO's largest entry is 256 (dimension bytes `0`,0). The returned iconPath is
  embedded into the exe by executable resource editing (`WinPackager.js:153-163`)
  and defaults the NSIS installer/uninstaller icons (`targets/nsis/NsisTarget.js:191-198`,
  `MUI_ICON`/`MUI_UNICON` fall back to the application icon when
  `installerIcon.ico` is absent).
- `macPackager.js:362-383` — `mac.icon` ending in `.icns` is resolved via
  `getIconPath()` ("icns" format returns the file as-is), copied to
  `Contents/Resources/icon.icns`, and `CFBundleIconFile` is pointed at it.
- `targets/LinuxTargetHelper.js:169-180 computeDesktopIcons` — takes
  `linux.icon` as the first source; `iconConverter.js buildSourceCandidates`
  resolves a directory candidate; `collectIconsFromDir` collects every
  `NxN.png` file in the directory as one size-ordered set (format `"set"`),
  which is exactly our `resources/icons/{16..512}x{...}.png` ladder.
  An array value would also be accepted (sources are `asArray`'d), but the
  directory form feeds the whole ladder through one key.

## D2 — what electron-builder actually places inside an AppImage

**Decision**: no `extraResources` mapping is needed for the desktop-entry icon.
All three `findAppImageIcon` candidates are guaranteed by the AppImage launcher.

**Evidence** (`node_modules/app-builder-lib/out/targets/appimage/appLauncher.js:8-51`):
with icons configured, electron-builder stages

- `usr/share/icons/hicolor/<size>x<size>/apps/markdownmeister.png` for **every**
  configured icon size (`executableName` + extension), and
- symlinks from the stage root: `.DirIcon` and `<executableName>.png` both point
  at the largest staged icon (relative symlink into the hicolor tree).

Mounted, that is exactly the AppImage root, so `findAppImageIcon` finds:

1. `<mount>/.DirIcon` (present, PNG-encoded), then
2. `<mount>/markdownmeister.png`, then
3. `usr/share/icons/hicolor/<size>/apps/markdownmeister.png`.

The AppImage target also *fails* the build without an icon
(`appLauncher.js:21-23`: "At least one icon is required for AppImage"), so D1's
linux wiring is mandatory, not cosmetic.

**Recorded nuance (no change)**: the finder prefers `.DirIcon` first, which is
the *largest* staged PNG, and spec 035's mechanism copies whatever it finds into
the single `hicolor/256x256/apps/` slot. A freedesktop launcher scales either
way; changing the preference order or installing a ladder would touch spec
035's frozen contract (spec Assumptions: "without changing what it installs"),
so the existing behaviour stands and is documented here instead.

## D3 — runtime window icon (win32/linux)

**Decision**: pass `icon: <repo>/resources/icon.png` to the `BrowserWindow`
constructor on non-macOS platforms, resolving relative to `__dirname`
(`out/main/index.js` → `../../resources/icon.png`). Ship the file via a new
`extraResources` entry so the same relative layout holds packaged
(`<install>/resources/app.asar/out/main` → `../../resources` =
`<install>/resources/icon.png`) and in dev (`out/main` → repo `resources/`).

macOS is excluded: the Dock icon comes from the bundle's icns automatically
(D2/macPackager evidence); overriding `app.dock.setIcon` per-window is not
conventional and is out of scope.

Why the window option matters despite the exe/bundle icon: in development the
binary is Electron's own exe (default framework icon in taskbar/title bar), and
on Linux many shells take the running window's icon from the window-manager
properties rather than the .desktop entry alone. Windows installed builds get
the taskbar icon from the exe resource regardless; the explicit option makes
dev and Linux correct without platform-specific code beyond the darwin guard.

`resources/icon.png` (512×512) was generated for exactly this purpose
(script comment: "512x512 convenience master for electron-builder").

## D4 — Scoop and macOS inheritance

**Decision**: no Scoop- or macOS-specific work; inheritance verified by reading
what each surface references.

- **Scoop** (`markdownmeister.json`, read-only): `shortcuts` entries reference
  `markdownmeister.exe`. Windows derives a shortcut's display icon from the
  target executable's embedded icon group when no explicit icon is given — the
  same resource D1 edits into the exe. The manifest's `post_install` passes
  `-ExePath "$dir\markdownmeister.exe"` to `open-with.ps1`, whose registered
  verbs likewise point their `Icon` at the exe. Both surfaces therefore show
  the product icon once the exe carries it.
- **macOS**: D1/D2 — CFBundleIconFile → Contents/Resources/icon.icns drives the
  Finder, Applications folder, and Dock representations; nothing else to wire.
- **Windows installer/uninstall entry**: NsisTarget uses the app icon for
  `MUI_ICON`/`MUI_UNICON` (D1), which paints installer pages and the
  installed-programs entry (Add/Remove Programs reads the uninstaller's
  displayed icon).

## D5 — FR-005 production route deferred

The spec requires AI image generation (Nano Banana/Grok) plus human selection.
Per explicit maintainer authorization (2026-08-23) this route is **deferred**;
the artwork was authored directly by the ox-alpha model as a minimal geometric
mark meeting FR-006's constraints. Recorded in plan.md Complexity Tracking and
documented fully in `docs/icon-provenance.md` (description, derivation chain,
regeneration command, and the route to run if/when the AI-generation pass is
executed). No silent downgrade: FR-005 is unmet and tracked, everything else is
implemented against the committed artwork.

## D6 — reproducibility contract

`scripts/generate-icon-master.ps1` re-renders every committed raster asset from
the geometry constants mirrored from `assets/icon/master.svg` (tile inset/radius,
gradient stops, mark polyline). Re-running it reproduces **structurally
equivalent** assets: identical dimensions, colour types, ICO directory shape,
and ICNS chunk layout. PNG *bytes* may differ between runs/machines because
GDI+ encoder output is not guaranteed byte-stable; dimensional/structural
equivalence is the contract (matches SC-005's "functionally equivalent"). This
is also what the unit tests assert: structure, not byte identity.

## D7 — test strategy

- **Unit (pure TS, no new dependencies)**: parse the committed binaries'
  leading structures — PNG IHDR (width/height/colour type), ICO header +
  directory entries, ICNS magic/length/chunk walk — per constitution V
  ("test what can corrupt"): these are silent-failure formats where a wrong
  dimension byte or truncated chunk ships unnoticed.
- **Desktop entry**: extend the existing suite with the electron-builder
  AppImage layout from D2 as the fixture, proving the icon-found install path
  end-to-end against the real packaging output shape.
- **E2E**: assert the main window exposes a non-null icon with sane dimensions
  via `BrowserWindow.getIcon()` inside `electronApp.evaluate`. Honest caveat:
  `getIcon()` reflects the window-icon option (D3), not the shell/taskbar
  rendering, which remains manual verification (quickstart.md).
