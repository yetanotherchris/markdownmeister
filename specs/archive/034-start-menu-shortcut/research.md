# Research: Scoop Start Menu Shortcut

Feature: specs/archive/034-start-menu-shortcut/spec.md · Date: 2026-08-21

## R1 — Scoop natively supports Start Menu shortcuts

**Decision**: Use Scoop's `shortcuts` manifest property with the single entry `["markdownmeister.exe", "MarkdownMeister"]`.

**Rationale**: Verified against the official Scoop wiki (App Manifests) and the locally installed Scoop 0.5.3. `shortcuts` takes an array of `[target, name, args?, icon?]`; entries are created under `Start Menu\Programs\Scoop Apps` on install *and* refresh on update, and are removed on uninstall. Declaring it satisfies FR-001/002/003 and the creation/removal halves of FR-005/006 through the package manager's own behaviour, with zero code.

**Alternatives considered**:

- A `post_install` script creating a `.lnk` via `WScript.Shell` — rejected: duplicates built-in functionality, adds uninstall handling we would have to get right ourselves, and is exactly what `shortcuts` exists to avoid.
- Leave it to the NSIS installer only — rejected: serves installer users but leaves Scoop users (the spec's subject) with nothing.

## R2 — Icon comes from the executable

**Decision**: Omit the optional third/fourth elements (arguments, icon path).

**Rationale**: The repository contains no icon assets (no `.ico`/`.icns`/`.png` anywhere), so there is no separate icon file to pin. When no icon path is given, Windows uses the target executable's embedded icon — which is also what the taskbar and window already show, keeping every surface consistent. An entry without an icon path cannot break because a renamed asset went missing.

**Alternatives considered**:

- Pin `$dir\resources\app.ico` — rejected: no such asset exists; the declaration would reference a phantom file.
- Introduce a custom application icon as part of this feature — rejected as out of scope (spec Assumption); it is a packaging concern of its own and would not change how the shortcut is declared.

## R3 — Release regeneration preserves the declaration

**Decision**: `updatescoop.ps1` keeps its patch-only behaviour, hardened with an explicit guard that throws if the loaded manifest has no `shortcuts` property.

**Rationale**: Read the script: it loads the committed manifest, assigns only `version`, `architecture."64bit".url`, and `architecture."64bit".hash`, then writes back with `ConvertTo-Json -Depth 10`. Every other property — including the nested-array `bin` entry — has survived releases v1.0.0 → v1.1.0 through this exact code path, which demonstrates nested arrays survive the round-trip at depth 10. The guard converts the one silent failure mode (a future edit dropping the declaration) into a loud release failure at the exact moment the file is rewritten, enforcing FR-007 rather than hoping for it.

**Alternatives considered**:

- Rewrite the manifest from a template each release — rejected: larger change to a release-critical script for no benefit over patching.
- Rely only on the unit test — insufficient alone: the test guards the committed tree at PR time, but the rewrite happens later, on the tag checkout in the release workflow; the guard covers that moment directly.

## R4 — Verification strategy

**Decision**: Vitest shape assertions on the committed `markdownmeister.json`, plus manual install/update/uninstall verification per quickstart.md.

**Rationale**: Quality gates run on ubuntu-latest (`.github/workflows/quality.yml`), so no CI environment can run Scoop. This matches spec 005's recorded outcome that package definitions are verified manually; its dedicated contract suite was removed in favour of manual verification. The unit test still earns its place: it runs everywhere, and any commit that drops or mangles the declaration fails immediately.

**Alternatives considered**:

- Invoke `updatescoop.ps1` from Vitest — rejected: PowerShell-dependent tests cannot run on the ubuntu CI runner, so they would be skipped exactly where regression matters most.
- Playwright e2e — not applicable: e2e drives the built app's UI; shortcut creation happens in the package manager outside the app (recorded in the spec's Assumptions).
