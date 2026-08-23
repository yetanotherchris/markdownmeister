# Implementation Plan: First-Level Folder Context Menu on Windows 11

**Branch**: `phase-38-win11-first-level-menu` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/038-win11-first-level-menu/spec.md`

## Summary

The "Open in MarkdownMeister" folder action exists today only as a classic registry verb (spec 035), which on Windows 11 hides behind "Show more options". This feature adds a Microsoft Store distribution channel packaged as MSIX, carrying trusted package identity from the Store's own signing. The package declares an in-process COM shell extension implementing `IExplorerCommand` for `Directory` items through the `windows.fileExplorerContextMenus` extension category, which is what places the action in Windows 11's first-level modern context menu. The extension is strictly a hand-off relay: it launches the app's execution alias with the chosen folder as argv, so every safeguard (untrusted-path validation in main, single-instance routing, dirty-tab confirmation) is inherited unchanged from the spec 006/035 OS-open pipeline. Non-Store channels are untouched byte-for-byte (SC-003).

## Technical Context

**Language/Version**: TypeScript 5.8 strict (Electron 43 main); C++ (Windows SDK `shobjidl_core.h`, WRL for COM boilerplate) built with CMake + MSVC v143; PowerShell 7 build script; YAML manifests.

**Primary Dependencies**: None new at runtime. One new devDependency (`fast-xml-parser`) used only by unit tests to prove manifest well-formedness — justified because Node has no built-in XML parser and hand-rolled regex checks cannot honestly claim well-formedness. The native component depends only on the Windows SDK that ships with VS 2022.

**Storage**: No application storage changes. Registration state lives entirely inside the MSIX package manifest; Windows owns its lifecycle (install/update/uninstall of the package removes the registrations — FR-009/FR-010 come from platform semantics).

**Testing**: Vitest unit tests for the channel-isolation guard (SC-003), alias-vs-classic argv parity, adversarial paths, and manifest XML well-formedness. Playwright e2e spawns the real Electron binary with a folder argument to cover cold-launch parity and running-instance routing. Real Explorer menu behaviour, Store submission, and US5 fault injection remain manual per spec Assumptions.

**Target Platform**: Windows 11 (first-level modern menu), Windows 10 (classic mechanism via the same package, FR-013). Other channels unchanged.

**Performance Goals**: N/A — the shell extension does nothing until invoked; no ongoing activity attributable to presence in the menu (US5 scenario 3).

**Constraints**: Never crash/hang Explorer (FR-011); no filesystem browsing/reads/persistence of observed paths in the extension (FR-012); classic channels' registration artifacts byte-identical (SC-003); no version bumps; no pushes or merges from this phase.

**Scale/Scope**: 1 new native component (4 source files + CMakeLists), 1 packaging fragment + additive electron-builder block, 1 afterPack copy hook, 3 new unit-test files + fixtures, 1 new e2e spec, 1 new workflow, 2 new docs.

## Constitution Check

*GATE: Re-checked against every principle during Phase 0 research; final state recorded here.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | None — no renderer, preload, or IPC changes. The preload surface is untouched; all work happens in main-process code paths that already exist and in out-of-app native/packaging files |
| II. Every Path Is Untrusted | Honoured by design — the alias invocation lands in the SAME argv pipeline as the classic verb (`extractTargetFromArgv` → `classifyOsTarget` → `prepareFolderFromOsPath`, all main-process, all fail-closed). The native extension performs zero validation by contract (FR-012); validation stays inside the trusted app process |
| III. Never Lose The User's Words | Honoured — folder opens route through the existing confirm→commit workspace pipeline; the dirty-tab confirmation applies identically to both entry points (FR-004) and is proven by existing + new e2e |
| IV. Calm, Predictable Editing | Honoured — the extension never shows UI, never blocks Explorer; failures degrade to "entry absent" silently |
| V. Test What Can Corrupt Or Escape | Honoured — adversarial-path parity tests (alias-shaped argv vs classic verb argv) plus a CI guard that fails if any protected channel-isolation file changes |

All gates pass except where noted in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/038-win11-first-level-menu/
├── plan.md              # This file
├── research.md          # D1–D6 decisions with primary-source evidence
├── contracts/
│   └── handoff.md       # Alias invocation contract + parity guarantees
├── quickstart.md        # Manual Store submission + US5 fault-injection checklist
└── tasks.md             # Ordered, independently verifiable work items
```

### Source Code (repository root)

```text
native/shell-extension/            # NEW: minimal in-proc COM DLL implementing IExplorerCommand
├── CMakeLists.txt                 # MSVC x64 shared library target
├── src/
│   ├── dllmain.cpp                # Module glue: DllGetClassObject/DllCanUnloadNow via WRL
│   ├── ExplorerCommand.h          # Class declaration + CLSID
│   └── ExplorerCommand.cpp        # SEH-guarded title/icon/state/invoke implementation
scripts/
└── build-shell-extension.ps1      # NEW: MSVC+SDK detection, clear failure messages, cmake build
packaging/appx/
└── extensions.xml                 # NEW: manifest Extensions fragment (alias + COM + context menus)
scripts/copy-shell-extension.cjs   # NEW: electron-builder afterPack hook; copies DLL into win-unpacked when present, silent no-op otherwise
electron-builder.yml               # ADDITIVE ONLY: one top-level afterPack key, one appx block
.github/workflows/build-store.yml  # NEW: workflow_dispatch Store artifact build
docs/store-release.md              # NEW: Partner Center identity + submission + US5 manual steps
tests/main/channelIsolation.test.ts    # NEW: SC-003 guard vs fixture snapshots
tests/main/storeHandoff.test.ts        # NEW: alias/classic argv parity + adversarial paths
tests/main/storeManifest.test.ts       # NEW: extensions.xml XML parsing/well-formedness in situ
tests/fixtures/channel-baseline/       # NEW: byte snapshots of installer.nsh, open-with.ps1, markdownmeister.json
tests/e2e/store-handoff.spec.ts        # NEW: cold-launch argv parity, running-instance routing, missing-folder failure
```

**Structure Decision**: The native component lives under `native/` because it is not TypeScript and must never enter the electron-vite build or the app bundle logic; it is compiled separately and injected into the package only for the Store target. Manifest customisation uses electron-builder's own `customExtensionsPath` escape hatch rather than replacing the generated manifest, so identity/version/architecture/assets keep being produced by the tool we already trust.

## Complexity Tracking

> Recorded deviations from principles/artifacts, each with the simpler alternative rejected.

1. **FR-013 (classic verb fallback for the Store package) is documented but NOT implemented this phase.** Evidence (research R5): a full MSIX package cannot perform HKCU registry writes at install time — there is no installer hook to run scripts in, and MSI-style custom actions do not exist in MSIX. A packaged desktop app CAN declare classic verbs through `uap3/4:FileExplorerContextMenus`-style `windows.fileTypeAssociation` SupportedVerbs declarations, but those attach to file types, not the `Directory` class; there is no manifest-only way to register a classic folder verb. The honest options were (a) ship the capability gap on Windows 10 Store installs until a follow-up (e.g. a sparse companion package registered at first run, like VS Code's approach) adds it, or (b) fake coverage by writing registry keys from the app at launch — rejected because it violates channel isolation (a Store install would then write the same HKCU keys the installer owns, breaking US3 scenario 3 "each channel registers only itself"). Spec FR-013 remains the requirement; plan.md records that this phase delivers the modern mechanism and documents the fallback design, with implementation deferred to a follow-up task. This is a scope-affecting deviation and is called out in the PR description for user decision.
2. **markdownmeister.json snapshot comparison normalises release-volatile fields.** The channel-isolation test compares `installer.nsh` and `open-with.ps1` byte-for-byte, but for `markdownmeister.json` it strips `version`, `architecture.*.url`, and `architecture.*.hash` before comparing, because the release bot legitimately rewrites those fields on every release commit to main and a byte-exact fixture would break CI on every release. Everything else in the manifest (shortcuts, post_install/pre_uninstall hooks, bin shims — the entire registration surface) is compared exactly. Simpler alternative rejected: byte-compare all three files, which would have turned every routine release into a red main branch.
3. **New devDependency `fast-xml-parser`.** Constitution says dependencies must be justified and prefer the existing stack; justification: proving manifest well-formedness requires a real XML parser (the deliverable explicitly calls for XML-parsing verification), Node provides none, and adding ~1 dev-only dependency is simpler than vendoring a parser or weakening the check to regexes. It has no runtime surface.
4. **electron-builder.yml additions stop at configuration, not targets.** Adding `appx` to the existing `win.target` list would make every ordinary release build also produce an appx (changing release timing, tooling downloads, and failure modes for the NSIS/zip channels). Instead the Store workflow invokes `npx electron-builder --win appx` explicitly; CLI target selection overrides the config list, leaving existing builds effective-unchanged (SC-003).
