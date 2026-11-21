$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDirectory = Join-Path $projectRoot '.runtime.local'
New-Item -ItemType Directory -Force $runtimeDirectory | Out-Null
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = Join-Path $runtimeDirectory 'node/node.exe'
if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source }
if (!(Test-Path -LiteralPath $nodeExecutable)) {
    throw 'Node.js is required. Install Node.js 24 LTS, then launch again.'
}

function Test-Endpoint([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch { return $false }
}

function Start-AppServer([string]$name, [string]$entry, [string]$url) {
    if (Test-Endpoint $url) { return }
    $outputLog = Join-Path $runtimeDirectory "$name.log"
    $errorLog = Join-Path $runtimeDirectory "$name.error.log"
    $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList ('"' + $entry + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Test-Endpoint $url) { return }
        if ($serverProcess.HasExited) {
            throw "$name failed to start. $(Get-Content -LiteralPath $errorLog -Raw)"
        }
        Start-Sleep -Seconds 1
    }
    throw "$name did not become ready. Check $errorLog"
}

Start-AppServer 'backend' (Join-Path $projectRoot 'backend/server.js') 'http://localhost:8080/api/rooms'
Start-AppServer 'frontend' (Join-Path $projectRoot 'node_modules/vite/bin/vite.js') 'http://localhost:5173'
Write-Output 'Hotel app is ready at http://localhost:5173'
