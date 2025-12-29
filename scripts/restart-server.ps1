param(
    [int]$Port = 2000,
    [switch]$Debug,
    [switch]$Force,
    [switch]$Attach
)

Write-Host "🔁 Restart script invoked (app.js) — Port=$Port, Debug=$Debug, Force=$Force"

# Find running node processes whose command line mentions app.js
$nodeProcs = Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node' -and $_.CommandLine -match 'app\.js' }

if ($nodeProcs) {
    foreach ($p in $nodeProcs) {
        Write-Host "Stopping existing node process PID=$($p.ProcessId): $($p.CommandLine)"
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 200
        } catch {
            Write-Warning "Failed to stop PID $($p.ProcessId): $_"
            if (-not $Force) { Write-Host 'Run again with -Force to override.'; exit 1 }
        }
    }
} else {
    Write-Host "No running node app.js processes found."
}

# Set environment variables for the new process
$env:PORT = $Port
if ($Debug) { $env:DEBUG_LOGS = 'true' } else { Remove-Item Env:DEBUG_LOGS -ErrorAction SilentlyContinue }

# Ensure logs directory exists
$logDir = Join-Path $PSScriptRoot '..'
$stdout = Join-Path $logDir 'server.log'
$stderr = Join-Path $logDir 'server.err'

Write-Host "Starting node app.js with PORT=$Port (logs: $stdout, $stderr)"
if ($Attach) {
    Write-Host "🔗 Starting node app.js attached to this session (PORT=$Port)."
    # Run node in the current session so output appears here
    & node app.js
} else {
    Start-Process -FilePath 'node' -ArgumentList 'app.js' -RedirectStandardOutput $stdout -RedirectStandardError $stderr -NoNewWindow -PassThru | Out-Null
    Write-Host "✅ Restart initiated. Check $stdout and $stderr for details."
}
