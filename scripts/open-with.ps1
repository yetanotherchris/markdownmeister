param(
  [Parameter(Mandatory = $true)][ValidateSet('register', 'unregister')][string]$Action,
  [Parameter(Mandatory = $true)][string]$ExePath
)

$ErrorActionPreference = 'Stop'

$verb = 'MarkdownMeister'
$fileDisplay = 'Open with MarkdownMeister'
$folderDisplay = 'Open in MarkdownMeister'
$exts = '.md', '.markdown'
$classesRoot = 'HKCU:\Software\Classes'
$machineClassesRoot = 'HKLM:\Software\Classes'

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

function Add-Verb([string]$class, [string]$display) {
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
  if ($class -ne '*' -and $class -ne 'Directory' -and (Test-Path -LiteralPath "$classesRoot\$class")) {
    $default = (Get-ItemProperty -LiteralPath "$classesRoot\$class" -ErrorAction SilentlyContinue).'(default)'
    $subkeys = @(Get-ChildItem -LiteralPath "$classesRoot\$class" -ErrorAction SilentlyContinue)
    if ($subkeys.Count -eq 0 -and [string]::IsNullOrEmpty($default)) {
      Remove-Item -LiteralPath "$classesRoot\$class" -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($Action -eq 'register') {
  foreach ($ext in $exts) { Add-Verb (Get-FileClass $ext) $fileDisplay }
  Add-Verb 'Directory' $folderDisplay
} else {
  foreach ($ext in $exts) { Remove-Verb (Get-FileClass $ext) }
  Remove-Verb '*'
  Remove-Verb 'Directory'
  foreach ($ext in $exts) { Remove-Verb $ext }
}
