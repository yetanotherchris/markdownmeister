# Quickstart: Product Icon — manual verification matrix

The automated suite proves the committed assets are structurally correct and that the wiring exists. What only a human can verify is how the icon *renders* on real OS surfaces. Run through this checklist on a packaged build per platform (`npm run dist` produces installers under `dist/`; Scoop installs from the released zip; the AppImage mounts by double-click).

## Windows (installer)

- [ ] Taskbar while running: product mark, not Electron default; crisp at 100% and 125–200% scaling (mid/large ICO entries in use)
- [ ] Title-bar corner icon (16×16 entry): the "M" stroke reads as an M, not noise
- [ ] Start menu / Start "All apps" entry: product mark
- [ ] Installed-programs list (Settings → Apps): product mark
- [ ] Installer wizard pages (NSIS `MUI_ICON`): product mark
- [ ] Uninstall wizard + Add/Remove Programs entry: product mark
- [ ] Explorer context menu → "Open with MarkdownMeister" (spec 006 verb, Icon points at installed exe): product mark
- [ ] Alt-Tab switcher: product mark

## Windows (portable zip via Scoop)

- [ ] Shortcut created by Scoop (`markdownmeister.exe`): shows exe's embedded product icon
- [ ] Taskbar while running from the portable dir: product mark

## macOS

- [ ] Dock while running: product mark inside the platform squircle treatment without redesign artifacts
- [ ] Applications folder / Finder (app closed): same mark
- [ ] Cmd-Tab switcher: product mark
- [ ] DMG volume window icon: product mark

## Linux (AppImage)

- [ ] Launcher/menu entry after first launch created the desktop entry: product mark
- [ ] Running taskbar/dock item: product mark
- [ ] File manager "Open With" list for folders (spec 035 entry with `Icon=markdownmeister`): product mark

## Cross-platform rendering checks (every platform above)

- [ ] **Light background** (light taskbar/Dock/panel): mark retains contrast — dark navy tile against light chrome
- [ ] **Dark background** (dark taskbar/Dock/panel): light "M" stroke stays legible — no black-on-black halo or box
- [ ] **Transparency**: corners show the true background through the rounded tile — never a white/black box (catches converter mishandling)
- [ ] **16×16 recognisability**: at the smallest size the mark is still unambiguously this app
- [ ] **Design parity**: side-by-side screenshots of all three platforms read as one identical design (colour, geometry, proportions); only platform masking/padding differs
