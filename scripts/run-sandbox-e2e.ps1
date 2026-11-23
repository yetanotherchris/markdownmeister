<#
.SYNOPSIS
    Runs the Playwright e2e suite in a disposable Windows Sandbox.

.DESCRIPTION
    Uses the Windows Sandbox CLI (`wsb`), so the sandbox starts without the
    WindowsSandbox.exe desktop window. The repository, the host Node.js runtime,
    and a results folder are shared into the sandbox. The sandbox is always
    stopped in `finally` unless -KeepOpen is set.

.PARAMETER KeepOpen
    Keep the sandbox running after the suite finishes, for debugging.

.PARAMETER ReuseExisting
    Reuse an already-running sandbox instead of starting a new one. The sandbox
    is not stopped on exit in this mode.

.PARAMETER RunAs
    Account used to run the suite inside the sandbox. Defaults to System.

.PARAMETER TestArgs
    Optional Playwright test paths or flags. With no arguments the full suite
    runs. Example: `.\scripts\run-sandbox-e2e.ps1 tests/e2e/one-tab-per-file.spec.ts`.

.EXAMPLE
    .\scripts\run-sandbox-e2e.ps1
    .\scripts\run-sandbox-e2e.ps1 tests/e2e/one-tab-per-file.spec.ts
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [switch]$KeepOpen,
    [switch]$ReuseExisting,
    [ValidateSet("System", "ExistingLogin")]
    [string]$RunAs = "System",
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$TestArgs
)

$ErrorActionPreference = "Stop"

function Resolve-WsbPath {
    $cmd = Get-Command wsb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $alias = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\wsb.exe"
    if (Test-Path $alias) { return $alias }
    throw "Windows Sandbox CLI ('wsb') was not found."
}

function Resolve-NodeDir {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) { throw "Node.js ('node') was not found on PATH." }
    return Split-Path -Parent $nodeCmd.Source
}

function Get-SandboxIds {
    param([AllowEmptyString()][string]$Raw)
    if ([string]::IsNullOrWhiteSpace($Raw)) { return @() }
    try {
        $parsed = $Raw | ConvertFrom-Json
    } catch {
        return @(($Raw -split "`r?`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    if ($null -eq $parsed) { return @() }
    if ($parsed.PSObject.Properties.Name -contains 'WindowsSandboxEnvironments') {
        return @($parsed.WindowsSandboxEnvironments | ForEach-Object { $_.Id } | Where-Object { $_ })
    }
    if ($parsed.PSObject.Properties.Name -contains 'Id') {
        return @($parsed.Id)
    }
    return @($parsed | ForEach-Object { $_.Id } | Where-Object { $_ })
}

function Format-CmdArgument {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Argument)
    # cmd.exe treats these as syntax on the call line. Quote the argument and
    # double % so the generated batch file does not expand it.
    if ($Argument.Length -eq 0) { return '""' }
    if ($Argument -notmatch '[\s&|<>^%"]') { return $Argument }
    $escaped = $Argument.Replace('%', '%%').Replace('"', '\"')
    return '"' + $escaped + '"'
}

if ($env:MM_SANDBOX_E2E_LIB_ONLY -eq '1') { return }

$wsb = Resolve-WsbPath
$nodeDir = Resolve-NodeDir
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputDir = Join-Path $repoRoot "test-results\sandbox"
$sandboxRepo = "C:\markdownmeister"
$sandboxNode = "C:\nodejs"
$sandboxResults = "C:\test-results"

if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
    throw "node_modules not found in $repoRoot. Run 'npm install' first."
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$existingRaw = & $wsb list --raw 2>$null
$existingIds = @(Get-SandboxIds ([string]$existingRaw))

$sandboxId = $null
$startedByScript = $false

try {
    if ($existingIds.Count -gt 0) {
        if (-not $ReuseExisting) {
            throw "A Windows Sandbox is already running ($($existingIds -join ', ')). Stop it with 'wsb stop --id <id>' or pass -ReuseExisting."
        }
        $sandboxId = $existingIds[0]
        Write-Host "Reusing Windows Sandbox $sandboxId" -ForegroundColor Cyan
    } else {
        Write-Host "Starting Windows Sandbox via 'wsb start'..." -ForegroundColor Cyan
        $startRaw = & $wsb start --raw
        if ($LASTEXITCODE -ne 0) { throw "wsb start failed with exit code $LASTEXITCODE." }
        $sandboxId = ($startRaw | ConvertFrom-Json).Id
        if (-not $sandboxId) { throw "Could not parse the sandbox id from '$startRaw'." }
        $startedByScript = $true
        Write-Host "Started Windows Sandbox $sandboxId" -ForegroundColor Green
    }

    Write-Host "Sharing the repository, Node.js, and results folder..." -ForegroundColor Cyan
    & $wsb share --id $sandboxId --host-path $repoRoot --sandbox-path $sandboxRepo --allow-write
    if ($LASTEXITCODE -ne 0) { throw "Failed to share the repository." }
    & $wsb share --id $sandboxId --host-path $nodeDir --sandbox-path $sandboxNode
    if ($LASTEXITCODE -ne 0) { throw "Failed to share the Node.js runtime." }
    & $wsb share --id $sandboxId --host-path $outputDir --sandbox-path $sandboxResults --allow-write
    if ($LASTEXITCODE -ne 0) { throw "Failed to share the results folder." }

    $ready = $false
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        for ($attempt = 1; $attempt -le 30; $attempt++) {
            & $wsb exec --id $sandboxId --run-as $RunAs -c "cmd /c echo ready" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
                break
            }
            Start-Sleep -Seconds 2
        }
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if (-not $ready) { throw "Timed out waiting for the sandbox to accept commands." }

    $exitCodeFile = Join-Path $outputDir "exitcode.txt"
    $consoleLog = Join-Path $outputDir "console.log"
    foreach ($stale in @($exitCodeFile, $consoleLog)) {
        if (Test-Path $stale) { Remove-Item $stale -Force }
    }

    $argLine = (@($TestArgs | ForEach-Object { Format-CmdArgument $_ }) -join " ").Trim()
    $runnerPath = Join-Path $outputDir "run-in-sandbox.cmd"
    $runner = @"
@echo off
set PATH=$sandboxNode;%PATH%
cd /d $sandboxRepo
call npm run test:e2e -- $argLine > $sandboxResults\console.log 2>&1
set PW_EXIT=%ERRORLEVEL%
echo %PW_EXIT% > $sandboxResults\exitcode.txt
exit /b %PW_EXIT%
"@
    Set-Content -Path $runnerPath -Value $runner -Encoding ASCII

    # Start the suite and return. A long wsb exec session dies with 0x80370107
    # when the VM is exited, which is not a Playwright result.
    Write-Host "Starting Playwright e2e inside Windows Sandbox..." -ForegroundColor Cyan
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $wsb exec --id $sandboxId --run-as $RunAs -d $sandboxRepo -c "cmd.exe /c start /b cmd.exe /c $sandboxResults\run-in-sandbox.cmd"
        if ($LASTEXITCODE -ne 0) { throw "Could not start the suite inside the sandbox (exit $LASTEXITCODE)." }
    } finally {
        $ErrorActionPreference = $prevEap
    }

    $deadline = (Get-Date).AddMinutes(90)
    $testExit = $null
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $exitCodeFile) {
            $rawExit = (Get-Content $exitCodeFile -Raw).Trim()
            if ($rawExit -match '^-?\d+$') {
                $testExit = [int]$rawExit
                break
            }
        }
        $listed = $true
        $listRaw = & $wsb list --raw 2>$null
        if ($LASTEXITCODE -eq 0 -and $listRaw) {
            $listed = @(Get-SandboxIds ([string]$listRaw)) -contains $sandboxId
        }
        if (-not $listed) {
            throw "Windows Sandbox $sandboxId exited before the suite wrote an exit code."
        }
        Start-Sleep -Seconds 15
    }
    if ($null -eq $testExit) { throw "Timed out after 90 minutes waiting for the sandbox suite." }

    $consoleLog = Join-Path $outputDir "console.log"
    if (Test-Path $consoleLog) {
        Write-Host "`n--- Windows Sandbox e2e output ---" -ForegroundColor Yellow
        Get-Content $consoleLog | Write-Host
        Write-Host "----------------------------------`n" -ForegroundColor Yellow
    }

    if ($testExit -ne 0) { throw "Playwright e2e failed inside Windows Sandbox (exit code $testExit)." }
    Write-Host "Playwright e2e passed inside Windows Sandbox." -ForegroundColor Green
} finally {
    if ($startedByScript -and $sandboxId -and -not $KeepOpen) {
        Write-Host "Stopping Windows Sandbox $sandboxId..." -ForegroundColor Cyan
        & $wsb stop --id $sandboxId *> $null
    }
}
