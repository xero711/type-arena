$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serverData = Join-Path $repositoryRoot 'apps\server\data'
$startupLog = Join-Path $serverData 'startup.log'
$runtimeRoot = Join-Path $serverData 'runtime'
$postgresRoot = Join-Path $runtimeRoot 'pgsql'
$postgresData = Join-Path $runtimeRoot 'postgres-data'
$postgresLog = Join-Path $serverData 'postgresql.log'
$nodeBinary = Join-Path $runtimeRoot 'node\node.exe'
$serverLog = Join-Path $serverData 'api.log'
$pgCtl = Join-Path $postgresRoot 'bin\pg_ctl.exe'
$pnpmCommand = (Get-Command pnpm.cmd -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $serverData | Out-Null
trap {
  $_ | Out-String | Add-Content -LiteralPath $startupLog
  throw
}

if (-not (Test-Path -LiteralPath $pgCtl)) { throw "PostgreSQL binary not found: $pgCtl" }
if (-not (Test-Path -LiteralPath $postgresData)) { throw "PostgreSQL data folder not found: $postgresData" }
if (-not (Test-Path -LiteralPath $nodeBinary)) { throw "Node.js binary not found: $nodeBinary" }

& $pgCtl -D $postgresData status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $postgresData -l $postgresLog -o '-h 127.0.0.1 -p 5432' -w start
  if ($LASTEXITCODE -ne 0) { throw 'Could not start local PostgreSQL.' }
}

$apiPort = 3001
$existingListener = Get-NetTCPConnection -State Listen -LocalPort $apiPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/health" -TimeoutSec 3
    if ($health.status -eq 'ok' -and $health.database -eq 'online') {
      "API already healthy on port $apiPort; skipping duplicate start." | Add-Content -LiteralPath $startupLog
      return
    }
  } catch { }
  throw "Port $apiPort is already in use but the TYPE ARENA API did not pass its health check."
}

Push-Location $repositoryRoot
try {
  & $pnpmCommand --filter '@type-arena/server' db:migrate *>> $startupLog
  if ($LASTEXITCODE -ne 0) { throw 'Could not apply database migrations before starting the API.' }
} finally {
  Pop-Location
}

Push-Location (Join-Path $repositoryRoot 'apps\server')
try {
  & $nodeBinary '.\dist\index.js' *>> $serverLog
  if ($LASTEXITCODE -ne 0) {
    $apiExitCode = $LASTEXITCODE
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/health" -TimeoutSec 3
      if ($health.status -eq 'ok' -and $health.database -eq 'online') {
        "Another API instance passed its health check after this process exited." | Add-Content -LiteralPath $startupLog
        return
      }
    } catch { }
    throw "TYPE ARENA API stopped with exit code $apiExitCode"
  }
} finally {
  Pop-Location
}
