# Quickstart: File Association (spec 006) — manual verification

**Branch**: `phase-030-file-association` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

The e2e suite covers the runtime plumbing (OS file/folder opens, second
instance, fail-closed paths). The two things e2e cannot prove — the installer's
Windows registry side effects and the macOS Finder declaration — are verified
manually here.

## 1. Build the installer

```powershell
npm run dist   # produces dist/markdownmeister-<ver>-windows-x64.exe (NSIS)
```

## 2. Windows: install → registry assertions → uninstall

Run from an elevated-free shell (the install is per-user):

```powershell
# baseline: current default for .md (record it)
cmd /c "assoc .md"

# silent install
Start-Process .\dist\markdownmeister-<ver>-windows-x64.exe -ArgumentList '/S' -Wait

# assertions — each must exist
reg query "HKCU\Software\Classes\.md\shell\Open with MarkdownMeister\command"
reg query "HKCU\Software\Classes\.markdown\shell\Open with MarkdownMeister\command"
reg query "HKCU\Software\Classes\Directory\shell\Open with MarkdownMeister\command"

# the pre-existing default must be UNCHANGED (same value as the baseline above)
cmd /c "assoc .md"
reg query "HKCU\Software\Classes\.md" /v ""            # (Default) still the baseline value
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice" -ErrorAction SilentlyContinue  # untouched if present

# cleanup
& "$env:LOCALAPPDATA\Programs\markdownmeister\Uninstall MarkdownMeister.exe" /S   # path per install; or via Add/Remove
reg query "HKCU\Software\Classes\.md\shell"            # verb gone
```

Manual check after install (no shell restart needed — `SHChangeNotify` is
called): right-click a `.md` file → the context menu shows **Open with
MarkdownMeister**; choosing it launches/activates the app with the file open.
Right-click a folder → the same item opens it as the workspace.

## 3. macOS: Finder declaration (UNVERIFIED — needs a Mac)

Build on macOS (`npm run dist`), then:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleDocumentTypes" out/markdownmeister-darwin-x64/MarkdownMeister.app/Contents/Info.plist
```

Confirm two entries exist: one for `.md`/`.markdown` (role `Viewer`,
`LSHandlerRank` `Alternate`) and one for `public.folder` (role `Viewer`). Then
run the app once (`open MarkdownMeister.app`), and in Finder:
- Right-click a `.md` file → **Open With** lists MarkdownMeister; choosing it
  opens the file in a tab.
- Right-click a folder → **Open With** lists MarkdownMeister; choosing it opens
  the folder as the workspace.
- With another editor set as the default for `.md`, double-clicking the file
  still opens that editor — the default is unchanged.

## 4. Quick runtime sanity (any platform, from the repo)

```powershell
npm run build
# opens <file> in a tab on launch
npx electron out/main/index.js C:\path\to\notes.md
# opens <folder> as the workspace on launch
npx electron out/main/index.js C:\path\to\notes-folder
# a second launch with the same user-data dir forwards to the running instance
npx electron out/main/index.js C:\path\to\another.md
```
