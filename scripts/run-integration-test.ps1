<#
.SYNOPSIS
    Starts the XenoGenesis server and runs the integration test suite.

.DESCRIPTION
    Automates the full test cycle:
    1. Kills any existing node app.js processes
    2. Starts the server in the background
    3. Waits for it to be ready (polls the port)
    4. Runs test_integration.js
    5. Captures the exit code and output
    6. Kills the server
    7. Reports pass/fail

.PARAMETER Port
    Server port (default: 2000)

.PARAMETER Rounds
    Number of experiment rounds to run (default: 10)

.PARAMETER KeepServer
    Don't kill the server after the test finishes

.PARAMETER Verbose
    Show full server output on failure

.EXAMPLE
    .\scripts\run-integration-test.ps1
    .\scripts\run-integration-test.ps1 -Rounds 21 -Verbose
#>

param(
    [int]$Port = 2000,
    [int]$Rounds = 10,
    [int]$StartupTimeout = 30,
    [switch]$KeepServer,
    [switch]$VerboseOutput
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerLog = Join-Path $ProjectRoot 'test_server.log'
$ServerErr = Join-Path $ProjectRoot 'test_server.err'
$TestLog = Join-Path $ProjectRoot 'test_integration_results.log'

# ── Colors ──────────────────────────────────────────────────
function Write-Step  ($msg) { Write-Host "  ▸ $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Fail  ($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Note  ($msg) { Write-Host "  ℹ️  $msg" -ForegroundColor DarkGray }

# ── Banner ──────────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║       XenoGenesis Integration Test Runner             ║" -ForegroundColor Yellow
Write-Host "╠═══════════════════════════════════════════════════════╣" -ForegroundColor Yellow
Write-Host "║  Port:    $($Port.ToString().PadRight(41))║" -ForegroundColor Yellow
Write-Host "║  Rounds:  $($Rounds.ToString().PadRight(41))║" -ForegroundColor Yellow
Write-Host "║  Timeout: $("${StartupTimeout}s startup".PadRight(41))║" -ForegroundColor Yellow
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""

$overallStart = Get-Date

# ─── Step 1: Kill existing server ────────────────────────────
Write-Step "Stopping existing node app.js processes..."
$nodeProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'node' -and $_.CommandLine -match 'app\.js' }

if ($nodeProcs) {
    foreach ($p in $nodeProcs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-Note "Killed PID $($p.ProcessId)"
        } catch {
            Write-Note "Could not kill PID $($p.ProcessId): $_"
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Note "No existing server processes found"
}

# Also free the port if something else holds it
$portCheck = netstat -ano 2>$null | Select-String ":${Port}\s.*LISTENING"
if ($portCheck) {
    $portPid = ($portCheck -split '\s+')[-1]
    if ($portPid -and $portPid -ne '0') {
        Write-Note "Port $Port held by PID $portPid — killing..."
        Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# ─── Step 2: Start server ────────────────────────────────────
Write-Step "Starting server on port $Port..."
$env:PORT = $Port
$env:LOG_LEVEL = 'warn'

# Remove old logs
Remove-Item $ServerLog -ErrorAction SilentlyContinue
Remove-Item $ServerErr -ErrorAction SilentlyContinue

$serverProc = Start-Process -FilePath 'node' `
    -ArgumentList 'app.js' `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $ServerLog `
    -RedirectStandardError $ServerErr `
    -NoNewWindow -PassThru

Write-Note "Server PID: $($serverProc.Id)"

# ─── Step 3: Wait for server to be ready ─────────────────────
Write-Step "Waiting for server to listen on port $Port (max ${StartupTimeout}s)..."
$ready = $false
$elapsed = 0

while ($elapsed -lt $StartupTimeout) {
    Start-Sleep -Seconds 1
    $elapsed++

    # Check if server process died
    if ($serverProc.HasExited) {
        Write-Fail "Server process exited with code $($serverProc.ExitCode)"
        if (Test-Path $ServerErr) {
            Write-Host "  Server stderr:" -ForegroundColor Red
            Get-Content $ServerErr | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
        }
        exit 1
    }

    # Check if port is listening
    $listening = netstat -ano 2>$null | Select-String ":${Port}\s.*LISTENING"
    if ($listening) {
        $ready = $true
        break
    }

    # Progress dot every 5 seconds
    if ($elapsed % 5 -eq 0) {
        Write-Note "${elapsed}s..."
    }
}

if (-not $ready) {
    Write-Fail "Server did not start within ${StartupTimeout}s"
    if (Test-Path $ServerErr) {
        Get-Content $ServerErr | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Ok "Server is ready (took ${elapsed}s)"

# ─── Step 4: Run integration test ────────────────────────────
Write-Host ""
Write-Step "Running integration test ($Rounds rounds)..."
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

$testArgs = "test_integration.js --port $Port --rounds $Rounds"
$testProc = Start-Process -FilePath 'node' `
    -ArgumentList $testArgs `
    -WorkingDirectory $ProjectRoot `
    -NoNewWindow -PassThru -Wait

$testExitCode = $testProc.ExitCode

Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

# ─── Step 5: Kill server (unless --KeepServer) ───────────────
if (-not $KeepServer) {
    Write-Step "Stopping server (PID $($serverProc.Id))..."
    if (-not $serverProc.HasExited) {
        Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
        Write-Ok "Server stopped"
    } else {
        Write-Note "Server already exited"
    }
} else {
    Write-Note "Server left running (--KeepServer)"
}

# ─── Step 6: Report results ──────────────────────────────────
$overallDuration = ((Get-Date) - $overallStart).TotalSeconds
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  TEST RESULTS" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Yellow

if ($testExitCode -eq 0) {
    Write-Host "  🎉 ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "  💥 SOME CHECKS FAILED (exit code: $testExitCode)" -ForegroundColor Red
}

Write-Host "  Duration: $([math]::Round($overallDuration, 1))s total" -ForegroundColor Gray

if (Test-Path $TestLog) {
    Write-Host "  Log: $TestLog" -ForegroundColor Gray
    
    # Extract and display the validation checks from the log
    $logContent = Get-Content $TestLog -Raw
    $checksSection = $false
    Get-Content $TestLog | ForEach-Object {
        if ($_ -match 'VALIDATION CHECKS') { $checksSection = $true }
        if ($checksSection -and $_ -match '(✅|❌)') {
            $color = if ($_ -match '✅') { 'Green' } else { 'Red' }
            Write-Host "  $_" -ForegroundColor $color
        }
        if ($checksSection -and $_ -match 'OVERALL') {
            $checksSection = $false
            $color = if ($_ -match 'ALL CHECKS PASSED') { 'Green' } else { 'Red' }
            Write-Host "  $_" -ForegroundColor $color
        }
    }
}

# Show server errors if test failed and verbose
if ($testExitCode -ne 0 -and $VerboseOutput) {
    if (Test-Path $ServerErr) {
        $errContent = Get-Content $ServerErr
        if ($errContent) {
            Write-Host ""
            Write-Host "  Server errors:" -ForegroundColor Red
            $errContent | Select-Object -Last 20 | ForEach-Object {
                Write-Host "    $_" -ForegroundColor DarkRed
            }
        }
    }
}

Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

exit $testExitCode
