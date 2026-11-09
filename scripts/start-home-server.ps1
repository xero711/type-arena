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

Push-Location (Join-Path $repositoryRoot 'apps\server')
try {
  & $nodeBinary '.\dist\index.js' *>> $serverLog
  if ($LASTEXITCODE -ne 0) { throw "TYPE ARENA API stopped with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
