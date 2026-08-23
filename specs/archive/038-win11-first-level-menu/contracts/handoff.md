# Contract: Alias Invocation Hand-off

Date: 2026-08-23. What crosses the boundary between the shell extension (Explorer's process) and the application, and the guarantees both sides make. The renderer sees none of this; the app's IPC surface is unchanged.

## Invocation

The shell extension performs exactly one action in `IExplorerCommand::Invoke`:

```text
launch(detached): "<aliasDir>\markdownmeister.exe" "<chosen folder path>"
```

- `<aliasDir>` is `%LOCALAPPDATA%\Microsoft\WindowsApps` (where MSIX materialises execution aliases). If that file does not exist, a fallback launch of bare `markdownmeister.exe` via `ShellExecuteExW` is attempted once.
- The path is passed as ONE quoted argument, verbatim from the shell. No normalisation, no validation, no persistence, no reads of the target (FR-012).
- The launched process is never waited on; failure to launch returns E_FAIL and Explorer continues unaffected.

## Receiving side guarantees (unchanged code)

Both entry points — classic registry verb (`"<exe>" "%1"`) and alias invocation (`markdownmeister.exe "<folder>"`) — produce the same argv shape, so both flow through:

1. `initOsOpenHost()` extracts the target via `extractTargetFromArgv` (last absolute, non-switch, non-script argument).
2. Single-instance lock: cold launch either becomes THE instance or forwards argv through `second-instance` and exits. Identical for both placements (FR-005).
3. `classifyOsTarget` validates in main: realpath resolution, stat check, directory/file classification; failures are path-free messages ("no longer available", "not supported") rendered as quiet footer notes; session unchanged (US2 scenario 2/3, FR-004).
4. Folders route to `prepareFolderFromOsPath` → confirm→commit pipeline: dirty-tab confirmation before any workspace swap (FR-004), single prepared-slot guard, commit-time re-validation of the target.

**Parity claim**: there is no Store-specific branch anywhere in this pipeline. Parity is by construction (same argv shape) and is proven by unit tests comparing classification outcomes for verb-shaped vs alias-shaped argv over identical folders, including adversarial cases.

## Extension-side prohibitions (FR-012)

The COM DLL MUST NOT: enumerate or browse any filesystem location other than resolving its own module path (for the icon) and checking the alias file's existence; read any content; write anything anywhere; show UI; pump messages; wait on processes; spawn threads. It holds no state between calls beyond static strings.

## Containment (FR-011)

Every exported function and COM method is wrapped in an SEH frame that converts any fault into a silent failure HRESULT. Worst permitted outcome: the MarkdownMeister entry does not appear / does nothing. Explorer must never crash, hang, or lose other entries due to this component.

## Manifest declarations owned by this feature

| Declaration | Purpose |
|-------------|---------|
| `uap3:Extension Category="windows.appExecutionAlias"` → `desktop:ExecutionAlias Alias="markdownmeister.exe"` | The hand-off launcher exists at a stable per-user path |
| `com:Extension Category="windows.comServer"` → `com:SurrogateServer` + `com:Class Id=<CLSID> Path="app\resources\shell-extension\MarkdownMeisterShellExtension.dll" ThreadingModel="STA"` | Packaged COM registration of the handler class |
| `desktop4:Extension Category="windows.fileExplorerContextMenus"` → `desktop4:ItemType Type="Directory"` → `desktop4:Verb Id="MarkdownMeister.OpenFolder" Clsid=<CLSID>` | First-level modern-menu placement for Directory items only |

Uninstall/update/removal of these registrations is owned by Windows package lifecycle: removing the package removes all three atomically (FR-009); an update re-registers them against the updated version (FR-010). No other channel writes any of them; no Store-channel code writes HKCU verbs (channel isolation, US3).

## Identity placeholders (Partner Center)

`identityName`, `publisher`, and `publisherDisplayName` in electron-builder.yml are clearly marked placeholders. They MUST be replaced with the values Partner Center assigns when the developer account reserves the product name, BEFORE submission; the manifest cannot validate locally without syntactically valid values but real submission requires the exact assigned identity. See docs/store-release.md.
