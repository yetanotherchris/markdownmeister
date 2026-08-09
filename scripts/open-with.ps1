# Spec 006 registration fix (2026-08-09): register/remove the
# "Open with MarkdownMeister" context-menu verb against the EFFECTIVE file type.
#
# The shell ignores verbs registered under the bare extension key when a Windows
# user-choice default exists (the file resolves to the chosen ProgID). This
# script therefore resolves the effective ProgID and registers the verb under
# its per-user class when that is safe and targeted: when the class already
# exists in HKCU (a per-user choice, e.g. md_auto_file), or when the ProgID is
# dead (registered nowhere, e.g. a dangling class default) so creating it in
# HKCU shadows nothing. Otherwise it falls back to `*` (AllFilesystemObjects),
# which the shell always enumerates. Folders register under `Directory`. Used
# by the Scoop manifest hooks and mirrors the installer logic in
# scripts/installer.nsh.
param(
  [Parameter(Mandatory = $true)][ValidateSet('register', 'unregister')][string]$Action,
  [Parameter(Mandatory = $true)][string]$ExePath
)

$ErrorActionPreference = 'Stop'

$verb = 'MarkdownMeister'
$display = 'Open with MarkdownMeister'
$exts = '.md', '.markdown'
$classesRoot = 'HKCU:\Software\Classes'
$machineClassesRoot = 'HKLM:\Software\Classes'

# The extension's effective ProgID: the user's chosen default (Windows
# user-choice), then the user-choice-latest, then the extension class default.
function Get-EffectiveProgId([string]$ext) {
  $fileExts = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext"
  $choice = Get-ItemProperty -LiteralPath "$fileExts\UserChoice" -ErrorAction SilentlyContinue
  if ($choice -and $choice.ProgId) { return $choice.ProgId }
  $latest = Get-ItemProperty -LiteralPath "$fileExts\UserChoiceLatest\ProgId" -ErrorAction SilentlyContinue
  if ($latest -and $latest.ProgId) { return $latest.ProgId }
  $cls = Get-ItemProperty -LiteralPath "Registry::HKEY_CLASSES_ROOT\$ext" -ErrorAction SilentlyContinue
  if ($cls -and $cls.'(default)') { return $cls.'(default)' }
  return $null
}

# The class to register the file verb under. The resolved ProgID is used when it
# is safe: already per-user in HKCU (no shadowing), or dead (registered nowhere)
# so a fresh HKCU class shadows nothing. A live machine ProgID would be shadowed
# by a fresh HKCU class, so that case falls back to `*`.
function Get-FileClass([string]$ext) {
  $prog = Get-EffectiveProgId $ext
  if ($prog) {
    if ((Test-Path -LiteralPath "$classesRoot\$prog") -or -not (Test-Path -LiteralPath "$machineClassesRoot\$prog")) {
      return $prog
    }
  }
  return '*'
}

function Add-Verb([string]$class) {
  # The .NET registry API is used (not New-Item) so the class name is treated
  # literally even when it is the `*` wildcard class (AllFilesystemObjects).
  $verbKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\$class\shell\$verb")
  $verbKey.SetValue('', $display)
  $verbKey.SetValue('Icon', $ExePath)
  $verbKey.Close()
  $commandKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\$class\shell\$verb\command")
  $commandKey.SetValue('', ('"{0}" "%1"' -f $ExePath))
  $commandKey.Close()
}

function Remove-Verb([string]$class) {
  Remove-Item -LiteralPath "$classesRoot\$class\shell\$verb" -Recurse -Force -ErrorAction SilentlyContinue
  # Drop a class we created fresh for a dead ProgID once it is empty again.
  # Never touch the predefined `*` / `Directory` classes or any class that still
  # carries content.
  if ($class -ne '*' -and $class -ne 'Directory' -and (Test-Path -LiteralPath "$classesRoot\$class")) {
    $default = (Get-ItemProperty -LiteralPath "$classesRoot\$class" -ErrorAction SilentlyContinue).'(default)'
    $subkeys = @(Get-ChildItem -LiteralPath "$classesRoot\$class" -ErrorAction SilentlyContinue)
    if ($subkeys.Count -eq 0 -and [string]::IsNullOrEmpty($default)) {
      Remove-Item -LiteralPath "$classesRoot\$class" -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($Action -eq 'register') {
  foreach ($ext in $exts) { Add-Verb (Get-FileClass $ext) }
  Add-Verb 'Directory'
} else {
  # Unregister: resolve the current locations plus the legacy extension-key
  # entries the v0.1.0 installer created (which the shell ignores).
  foreach ($ext in $exts) { Remove-Verb (Get-FileClass $ext) }
  Remove-Verb '*'
  Remove-Verb 'Directory'
  foreach ($ext in $exts) { Remove-Verb $ext }
}
