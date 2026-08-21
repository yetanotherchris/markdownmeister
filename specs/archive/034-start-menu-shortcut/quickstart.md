# Quickstart: Scoop Start Menu Shortcut

Feature: specs/archive/034-start-menu-shortcut/spec.md · Date: 2026-08-21

Automated coverage proves the declaration exists and survives regeneration; the scenarios below prove the user-visible behaviour on a real Windows machine with [Scoop](https://scoop.sh) installed.

## Prerequisites

- Windows 10/11 with Scoop installed (`scoop --version`)
- The project's bucket registered:

  ```powershell
  scoop bucket add markdownmeister https://github.com/yetanotherchris/markdownmeister
  ```

## Automated checks (any OS)

```powershell
npm test
```

`tests/main/scoopManifest.test.ts` asserts the committed manifest declares the shortcut exactly as specified in contracts/release.md. It fails if any commit drops or mangles the declaration.

## Scenario 1 — Clean install shows a Start Menu entry (US1, SC-001)

1. On a machine without the app installed, run the documented install command.
2. Open the Start Menu and type "MarkdownMeister".
3. Launch the entry.

**Expected**: an entry named "MarkdownMeister" with the application icon exists under Scoop Apps; clicking it opens the editor window directly, with no console window.

## Scenario 2 — Update keeps the entry working (US2, SC-002)

1. With an older version installed (e.g. the release before this change), run `scoop update markdownmeister`.
2. Open the Start Menu and launch "MarkdownMeister".

**Expected**: the entry exists after the update and launches the new version (check Help → About or the window title).

## Scenario 3 — Uninstall removes the entry (US2, SC-003)

1. Run `scoop uninstall markdownmeister`.
2. Search the Start Menu for "MarkdownMeister".

**Expected**: no entry remains; no dead shortcut is left behind.

## Scenario 4 — Release rewrite preserves the declaration (US3, SC-004)

1. Produce a dummy artifact named for a fake version, e.g. build once via `npm run dist`, then copy `dist/markdownmeister-*-windows-x64.zip` to `artifacts/markdownmeister-9.9.9-windows-x64.zip`.
2. Run `./updatescoop.ps1 -Version 9.9.9` in a scratch clone of the repository.
3. Inspect `markdownmeister.json`.

**Expected**: only `version`, `architecture."64bit".url`, and `architecture."64bit".hash` changed; `shortcuts` is present and unchanged. A manifest that lacks `shortcuts` makes the script throw instead of writing.

Restore the working copy afterwards if you ran the script against the real repository: `git checkout markdownmeister.json`.
