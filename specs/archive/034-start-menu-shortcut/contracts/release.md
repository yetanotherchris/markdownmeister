# Release Contract: Scoop Manifest

Feature: specs/archive/034-start-menu-shortcut/spec.md · Date: 2026-08-21

This document records the contract between this repository and Scoop for the Windows package definition (`markdownmeister.json`), including the shortcut introduced by spec 034 and the obligations of the release automation that rewrites the file.

## Shortcut declaration (FR-001 – FR-004)

The manifest MUST contain exactly one `shortcuts` entry:

```json
"shortcuts": [
  ["markdownmeister.exe", "MarkdownMeister"]
]
```

| Element | Value | Meaning |
|---------|-------|---------|
| 0 (target) | `markdownmeister.exe` | Packaged executable, relative to the install directory |
| 1 (name) | `MarkdownMeister` | Display name shown in the Start Menu |
| 2 (arguments) | omitted | Launching starts the app with no arguments (FR-003) |
| 3 (icon) | omitted | Windows uses the executable's embedded icon (FR-004) |

Consequences delegated to Scoop once declared: creation under `Start Menu\Programs\Scoop Apps` on install and update, removal on uninstall (FR-005, FR-006).

## Regeneration contract (FR-007)

`updatescoop.ps1` MAY assign only:

- `version`
- `architecture."64bit".url`
- `architecture."64bit".hash`

It MUST preserve every other property, including `shortcuts`, `post_install`, `pre_uninstall`, `license`, and `description`. The script guards this obligation directly: if the loaded manifest has no `shortcuts` property, it throws before writing, failing the release instead of publishing a definition that lost the declaration.

The committed tree is additionally guarded by `tests/main/scoopManifest.test.ts`, which fails any commit whose manifest drops or mangles the declaration or the preserved install hooks.
