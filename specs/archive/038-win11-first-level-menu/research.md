# Research: First-Level Folder Context Menu on Windows 11

Date: 2026-08-23. Each decision states the choice, the evidence, and the rejected alternatives. Platform behaviour claims were verified against primary sources during this phase (Microsoft Learn schema/how-to pages, microsoft/terminal manifest, microsoft/vscode sparse-package artifacts) and against the installed electron-builder 26.15.3 source in `node_modules/`.

## R1 — The Win11 modern context-menu mechanism: MSIX package identity + IExplorerCommand COM server + windows.fileExplorerContextMenus

**Decision**: Ship the first-level entry as an in-process COM DLL implementing `IExplorerCommand`, declared in the AppxManifest through the `windows.fileExplorerContextMenus` extension category restricted to `Type="Directory"`, with the class registered via packaged COM (`com:Extension Category="windows.comServer"` → `com:SurrogateServer` → `com:Class` pointing at the DLL, `ThreadingModel="STA"`).

**Evidence**:

- Microsoft's how-to "Integrate your desktop app with Windows using packaging extensions" (`learn.microsoft.com/windows/apps/desktop/modernize/desktop-to-uwp-extensions`) contains the section "Specify a context menu handler for a file type": it instructs implementing a context menu handler via **IExplorerCommand**, defining a class GUID, then registering it in the manifest with (1) a `com:ComServer` application extension declaring the surrogate server/class and (2) a `desktop4:FileExplorerContextMenus` application extension mapping item types to the CLSID. Its example shows exactly this pair.
- Schema references: `element-com-comserver` and `element-desktop4-fileexplorercontextmenus` under `learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/`.
- Microsoft's sample: **ExplorerCommandVerb** (`github.com/microsoft/Windows-classic-samples/tree/master/Samples/Win7Samples/winui/shell/appshellintegration/ExplorerCommandVerb`) — the canonical IExplorerCommand implementation the doc cites.
- A shipped Store product using precisely this combination for folders is **Windows Terminal**: its Store manifest (`microsoft/terminal/blob/main/src/cascadia/CascadiaPackage/Package.appxmanifest`) declares `com:SurrogateServer DisplayName="WindowsTerminalShellExt"` with `com:Class Id=… Path="WindowsTerminalShellExt.dll" ThreadingModel="STA"` plus `desktop4:FileExplorerContextMenus` → `desktop5:ItemType Type="Directory"` → `desktop5:Verb Clsid=…`. VS Code does the same shape in its sparse package (`resources/win32/appx/AppxManifest.xml`, native DLL from `microsoft/vscode-explorer-command`).
- Package identity is the gate for modern placement: "Context menu extensions that implement IContextMenu will appear in the older context menu instead" — only IExplorerCommand-based entries get into the modern menu, and only packages can declare them ("make-apps-great-for-windows", cited already by spec 035 research D1/D2). Hence FR-001's Store/MSIX requirement.

**Namespace note (corrected during this phase by toolchain evidence)**: Microsoft's how-to shows the context-menu registration in all-`desktop4` — but its example registers a FILE type (`.rar`/`.contoso`), and the `desktop4:ItemType` schema restricts `@Type` to `*` or `.<extension>` patterns (`(\*|(\.[^.\\]+))`). Registering a FOLDER therefore requires the desktop5 revision of ItemType/Verb, which is exactly what Windows Terminal's shipped Store manifest does (`desktop5:ItemType Type="Directory"` inside `desktop4:FileExplorerContextMenus`). This was verified empirically during this phase: vendor makeappx rejected `Type="Directory"` under desktop4 with the pattern-constraint violation quoted above, and accepted it under desktop5.

**Alternatives considered**:

- *IContextMenu classic handler* — lands only in the legacy menu; cannot satisfy FR-003 by definition.
- *Sparse MSIX with external location* (`Add-AppxPackage -ExternalLocation`, the VS Code route) — works without the Store but yields NO trusted Store signing and no automatic install/update/uninstall lifecycle; spec 038 chose the Store route in its Clarifications. Rejected.
- *Manifest-declared classic verbs as fallback (FR-013)* — see R5; not feasible manifest-only.

## R2 — Hand-off mechanism: execution alias + argv, not COM data passing

**Decision**: `Invoke` obtains the folder path from the shell (`IShellItem::GetDisplayName(SIGDN_FILESYSPATH)`), then launches the app's **execution alias** detached, with the quoted folder as the sole argument: `markdownmeister.exe "<folder>"`. Nothing else crosses the boundary.

**Evidence**: The alias declaration (`uap3:AppExecutionAlias` → `desktop:ExecutionAlias Alias="markdownmeister.exe"`, per the same Microsoft how-to, "Start your application by using an alias") materialises `%LOCALAPPDATA%\Microsoft\WindowsApps\markdownmeister.exe`. Launching it produces exactly the argv shape the classic verb produces (`"<exe>" "%1"`), which flows into the existing `extractTargetFromArgv` scan-from-the-end heuristic (src/main/osOpen.ts). Single instance is enforced by Electron's `requestSingleInstanceLock`; the second process forwards argv via `second-instance` and exits (src/main/osOpenHost.ts) — identical for cold launch vs running instance because both are plain argv deliveries.

**Alternatives considered**:

- *Passing data via named pipes/shared memory from the extension* — extra IPC surface outside the audited pipeline; violates "identical behaviour" (FR-004) and Principle II's single validation chokepoint. Rejected.
- *Protocol activation (`markdownmeister://<path>`)* — introduces a second parsing path and URI-encoding hazards for adversarial paths; argv keeps bytes verbatim. Rejected.

## R3 — Containment design (US5/FR-011): SEH-guarded fail-fast, no UI, no waits

**Decision**: Every exported entry point and every COM method body is wrapped in an outer SEH frame whose handler swallows the exception and returns a failure HRESULT (or does nothing); C++ objects live in inner functions called by those frames (avoids C2712 unwind conflicts). No dialogs, no message pumps, no waits on the launched process, no threads. `GetState` returns enabled without touching the filesystem, so menu presence costs nothing (US5 scenario 3).

**Evidence**: Shell extensions run inside Explorer.exe; an unhandled exception there crashes the shell. SEH boundary frames are the standard containment for non-vital handlers; returning E_FAIL makes Explorer drop the entry silently rather than propagate failure. The worst permitted outcome per FR-011 — entry absent — follows directly from fail-closed HRESULTs.

**Alternatives considered**: /EHsc C++ try/catch alone — does not catch access violations reliably in mixed code and lets SEH escape from OS callbacks; WRL without guards still lets implementation bugs crash the host. Both rejected outright during implementation: the shipped module is hand-rolled COM with no WRL dependency anywhere (the planned WRL boilerplate was abandoned so every entry point could be a small auditable SEH boundary; see dllmain.cpp's header comment).

## R4 — Packaging: electron-builder appx target with an Extensions fragment

**Decision**: Configure electron-builder's existing `appx` target additively: one new top-level `afterPack` key pointing at `scripts/copy-shell-extension.cjs`, plus one new `appx:` block carrying identity placeholders, `displayName`, `applicationId`, and `customExtensionsPath: packaging/appx/extensions.xml`. The fragment file supplies the three Extensions declarations (alias, comServer, fileExplorerContextMenus) with their XML namespaces declared locally on the injected elements.

**Evidence** (verified against installed node_modules/app-builder-lib):

- `AppXOptions` supports `identityName`, `publisher`, `publisherDisplayName`, `displayName`, `applicationId`, `customExtensionsPath`, `customManifestPath`, `capabilities`, `minVersion`, `maxVersionTested` (scheme.json).
- `getExtensions()` appends the raw contents of `customExtensionsPath` (resolved against the project root) inside the generated `<Extensions>` element when set (AppxTarget.js) — namespace prefixes must therefore be declared on our fragment elements themselves, which is valid XML and schema-neutral.
- `writeManifest()` substitutes `${…}` placeholders including `${publisher}`, `${version}`, `${applicationId}`, `${executable}` (`app\<Product>.exe`), `${arch}`, `${extensions}`, `${minVersion/maxVersionTested}` (default MinVersion 10.0.14316.0 for x64).
- Unsigned Store-only builds are supported: `computePublisherName()` returns `publisherName || "CN=ms"` and logs "Windows Store only build — AppX is not signed" when no certificate is configured (windowsSignToolManager.js) — this is the local verification path.
- makeappx/makepri/signtool come from electron-builder's own downloaded `windows-kits-bundle-10_0_26100_0.zip` toolset (toolsets/windows.js) — local SDK installation is NOT required for packaging (only for building the C++ DLL).
- `afterPack` accepts a string module path resolved via `resolveFunction` (packager.js line 195) and fires after pack, before targets read win-unpacked — the standard injection point.
- Everything packed goes under `app\` inside the package root (mapping list in AppxTarget.build), so the DLL's manifest path is `app\resources\shell-extension\MarkdownMeisterShellExtension.dll`.

**Alternatives considered**:

- *Full custom manifest via `customManifestPath`* — resolved only inside the buildResources directory (getResource basename-clamps paths), which defaults to `build/`, gitignored and forbidden for tracked files by this phase's constraints. Would have required moving buildResources, touching shared config. Rejected.
- *Adding `appx` to `win.target`* — would change every ordinary release build (see plan Complexity Tracking 4). Rejected.
- *Hand-writing makeappx calls in CI instead of electron-builder* — duplicates identity/version/assets logic the tool already owns. Rejected.

## R5 — FR-013 classic fallback inside the Store package: honest limitation

**Decision**: Documented as infeasible manifest-only; implementation deferred with a proposed approach. Recorded as deviation 1 in plan.md Complexity Tracking.

**Evidence**: MSIX has no install-time script hooks (no NSIS-equivalent custom actions; the format deliberately forbids them), so the installer-channel route (HKCU writes at install time) cannot exist for the Store channel. Manifest-declared classic verbs exist only through `windows.fileTypeAssociation` `SupportedVerbs`, which attach to ProgIDs/file types — there is no `Directory` equivalent in the schema. A packaged app CAN write HKCU keys at runtime, but doing so from our app at launch would make the Store channel register into the same registry surface the NSIS/Scoop channels own, violating US3 scenario 3 ("nothing from the installer/Scoop scripts is present" on a Store-only machine) and muddying uninstall ownership (FR-009). Proposed follow-up (recorded as tasks.md T014, not built): a companion sparse identity package registered once at first run of the Store build — the pattern VS Code uses (`Add-AppxPackage -ExternalLocation`) — keeps channel isolation because the sparse package is part of the Store channel's own footprint. Precision note (spec-compliance review): the sparse package itself CANNOT declare the classic Directory verb either — it is bound by the same manifest schema. Closing FR-013 will still require the app-executed HKCU verb registration owned and cleaned by the Store channel's footprint (namespaced so US3 scenario 3 stays satisfied), with the sparse package providing identity and lifecycle anchoring for that footprint.

## R6 — Icon for the entry (FR-006)

**Decision**: `GetIcon` resolves its own module directory (the DLL lives at `app\resources\shell-extension\` inside the package) and returns `<package>\app\markdownmeister.exe,0` — the packaged executable is the single source of truth for the product image. Any failure returns an empty string (entry renders without icon) rather than failing the query. No icon asset is added to the repo; the exe is the single source of truth for the product image.

**Honest basis correction (correctness review)**: this decision assumed the packaged exe carries the product icon applied by electron-builder/rcedit. The repo currently ships no `.ico` and sets no `win.icon`/`build/icon.ico`, so until a real application icon lands, electron-builder embeds its DEFAULT Electron icon and the menu entry renders that artwork. The resolution mechanism above is correct and needs no change; supplying the actual product icon is release-branding work that must precede Store submission (FR-006's icon requirement is met only once that exists).

**Alternatives considered**: embedding a duplicate .ico in the DLL — second copy of brand asset that drifts; ms-resource references — require PRI resources and Store resource plumbing disproportionate for one string. Rejected both.

## References

### Mechanism

- How-to (context-menu handler + alias instructions): https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions
- File Explorer integration overview: https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/integrate-packaged-app-with-file-explorer
- Modern menu requires IExplorerCommand/package identity: https://learn.microsoft.com/en-us/windows/apps/get-started/make-apps-great-for-windows
- Schema: com:ComServer — https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-com-comserver
- Schema: desktop4:FileExplorerContextMenus — https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-desktop4-fileexplorercontextmenus
- Schema: uap3:AppExecutionAlias — https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap3-appexecutionalias
- IExplorerCommand API: https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-iexplorercommand
- Sample: ExplorerCommandVerb — https://github.com/microsoft/Windows-classic-samples/tree/master/Samples/Win7Samples/winui/shell/appshellintegration/ExplorerCommandVerb
- Shipped example (Store package, folder verb): https://github.com/microsoft/terminal/blob/main/src/cascadia/CascadiaPackage/Package.appxmanifest
- Sparse-package precedent: https://github.com/microsoft/vscode/blob/main/resources/win32/appx/AppxManifest.xml and https://github.com/microsoft/vscode-explorer-command

### Tooling (verified in installed dependencies)

- electron-builder AppXOptions scheme: `node_modules/app-builder-lib/scheme.json`
- AppxTarget manifest generation, customExtensionsPath splice, unsigned Store builds, vendor makeappx bundle: `node_modules/app-builder-lib/out/targets/AppxTarget.js`, `out/codeSign/windowsSignToolManager.js`, `out/toolsets/windows.js`
- afterPack string-hook resolution: `node_modules/app-builder-lib/out/packager.js`

### Prior art in this repo (consumed unchanged)

- Spec 035 research D1/D2/D6/D7 and contracts/registration.md (classic verb model this feature must not disturb)
- src/main/osOpen.ts + osOpenHost.ts (argv extraction, classification, queue/drain, single-instance routing)
