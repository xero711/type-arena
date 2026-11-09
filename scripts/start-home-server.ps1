$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$postgresRoot = Join-Path $env:LOCALAPPDATA 'TypeArena\PostgreSQL\18.6\pgsql'
$postgresData = Join-Path $env:LOCALAPPDATA 'TypeArena\PostgreSQL\data'
$postgresLog = Join-Path $env:LOCALAPPDATA 'TypeArena\PostgreSQL\postgresql.log'
$nodeBinary = Join-Path $env:LOCALAPPDATA 'TypeArena\NodeJS\22.23.4\node-v22.23.4-win-x64\node.exe'
$serverLog = Join-Path $repositoryRoot 'apps\server\data\api.log'
$pgCtl = Join-Path $postgresRoot 'bin\pg_ctl.exe'

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
