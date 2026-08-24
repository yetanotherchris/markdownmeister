# Quickstart: New Product Logo

Manual verification for the icon swap. Automated gates (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`) run alongside; this covers what only eyes can check.

## Regenerate from the master

```powershell
pwsh -File scripts/generate-icons.ps1
```

Expect: ladder written for 16–512, `resources/icon.png`, `resources/icon.ico`, `resources/icon.icns`, no output touching `assets/icon/master.png`.

## Visual checklist

1. Open `resources/icons/16x16.png` and `24x24.png` at actual size: the "M" and border ring stay recognisable, not a blob (SC-003).
2. Open `resources/icons/256x256.png` and `512x512.png`: crisp downsample of the new logo, no upscaling blur, no cropping (SC-002).
3. Place `resources/icon.png` on white and near-black backgrounds: clean edges, no black box, no halo (SC-006).
4. Inspect `resources/icon.ico` in Windows Explorer (file properties, large icons) and `resources/icon.icns` structure via the unit tests (SC-004).
5. `npm run dev`, check the window/taskbar icon is the new logo (SC-001).
6. Load `docs/site/index.html` locally: the header icon is the new logo (SC-001).

## Regression guard

`npm run test` must pass: the structural tests parse every committed binary (ladder, ICO, ICNS) and the byte-identity checks pin the derivation chain (ICO payloads = ladder files, window icon = 512 entry, site icon = 256 entry).
