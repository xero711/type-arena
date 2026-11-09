[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serverRoot = Join-Path $repositoryRoot 'apps\server'
$runtimeRoot = Join-Path $serverRoot 'data\runtime'
$nodeBinary = Join-Path $runtimeRoot 'node\node.exe'
$pgCtl = Join-Path $runtimeRoot 'pgsql\bin\pg_ctl.exe'
$pgRestore = Join-Path $runtimeRoot 'pgsql\bin\pg_restore.exe'
$postgresData = Join-Path $runtimeRoot 'postgres-data'
$postgresLog = Join-Path $serverRoot 'data\postgresql.log'
$resolvedBackupPath = (Resolve-Path -LiteralPath $BackupPath).Path
$previousPgPassword = $env:PGPASSWORD
$pushedLocation = $false

try {
  if (-not (Test-Path -LiteralPath $resolvedBackupPath -PathType Leaf)) { throw 'The selected backup file does not exist.' }
  foreach ($requiredPath in @($nodeBinary, $pgCtl, $pgRestore, $postgresData)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required local database file is missing: $requiredPath" }
  }

  Push-Location $serverRoot
  $pushedLocation = $true
  $settingsJson = & $nodeBinary -e 'require("dotenv").config({ path: ".env" }); const url = new URL(process.env.DATABASE_URL || ""); process.stdout.write(JSON.stringify({ host: url.hostname, port: url.port || "5432", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.replace(/^\//, "")) }));'
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($settingsJson)) { throw 'Could not read the local database connection settings.' }
  $connection = $settingsJson | ConvertFrom-Json
  if ($connection.host -notin @('127.0.0.1', 'localhost') -or $connection.port -ne '5432') {
    throw 'Restore stopped because DATABASE_URL is not the private local PostgreSQL endpoint.'
  }

  & $pgRestore --list $resolvedBackupPath *> $null
  if ($LASTEXITCODE -ne 0) { throw 'The selected file is not a readable PostgreSQL backup archive.' }
  if (-not $PSCmdlet.ShouldProcess("local database '$($connection.database)'", "Replace its saved data from '$([IO.Path]::GetFileName($resolvedBackupPath))'")) { return }

  & $pgCtl -D $postgresData status *> $null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $postgresData -l $postgresLog -o '-h 127.0.0.1 -p 5432' -w start *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start local PostgreSQL for restore.' }
  }

  $env:PGPASSWORD = $connection.password
  $restoreArguments = @('--exit-on-error', '--clean', '--if-exists', '--no-owner', '--no-privileges', '-h', '127.0.0.1', '-p', $connection.port, '-U', $connection.user, '-d', $connection.database, $resolvedBackupPath)
  & $pgRestore @restoreArguments
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore could not complete the database restore.' }
  "[$(Get-Date -Format s)] Restored local database from $([IO.Path]::GetFileName($resolvedBackupPath))." | Add-Content -LiteralPath (Join-Path $serverRoot 'data\backup.log')
} finally {
  if ($pushedLocation) { Pop-Location }
  $env:PGPASSWORD = $previousPgPassword
}
