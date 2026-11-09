$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serverRoot = Join-Path $repositoryRoot 'apps\server'
$serverData = Join-Path $serverRoot 'data'
$runtimeRoot = Join-Path $serverData 'runtime'
$backupRoot = Join-Path $serverData 'backups'
$backupLog = Join-Path $serverData 'backup.log'
$postgresData = Join-Path $runtimeRoot 'postgres-data'
$postgresLog = Join-Path $serverData 'postgresql.log'
$pgCtl = Join-Path $runtimeRoot 'pgsql\bin\pg_ctl.exe'
$pgDump = Join-Path $runtimeRoot 'pgsql\bin\pg_dump.exe'
$pgRestore = Join-Path $runtimeRoot 'pgsql\bin\pg_restore.exe'
$nodeBinary = Join-Path $runtimeRoot 'node\node.exe'
$backupFile = Join-Path $backupRoot ("type-arena-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$previousPgPassword = $env:PGPASSWORD
$pushedLocation = $false

try {
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  foreach ($requiredPath in @($pgCtl, $pgDump, $pgRestore, $nodeBinary, $postgresData)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required local database file is missing: $requiredPath" }
  }

  Push-Location $serverRoot
  $pushedLocation = $true
  $settingsJson = & $nodeBinary -e 'require("dotenv").config({ path: ".env" }); const url = new URL(process.env.DATABASE_URL || ""); process.stdout.write(JSON.stringify({ host: url.hostname, port: url.port || "5432", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.replace(/^\//, "")) }));'
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($settingsJson)) { throw 'Could not read the local database connection settings.' }
  $settings = $settingsJson | ConvertFrom-Json
  if ($settings.host -notin @('127.0.0.1', 'localhost') -or $settings.port -ne '5432') {
    throw 'Backup stopped because DATABASE_URL is not the private local PostgreSQL endpoint.'
  }
  if ([string]::IsNullOrWhiteSpace($settings.user) -or [string]::IsNullOrWhiteSpace($settings.database)) {
    throw 'The local database username or name is missing.'
  }

  & $pgCtl -D $postgresData status *> $null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $postgresData -l $postgresLog -o '-h 127.0.0.1 -p 5432' -w start *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start local PostgreSQL for the backup.' }
  }

  $env:PGPASSWORD = $settings.password
  $dumpArguments = @('-h', '127.0.0.1', '-p', $settings.port, '-U', $settings.user, '-d', $settings.database, '-F', 'c', '--no-owner', '--no-privileges', '-f', $backupFile)
  & $pgDump @dumpArguments *> $null
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump could not create the database backup.' }
  if (-not (Test-Path -LiteralPath $backupFile) -or (Get-Item -LiteralPath $backupFile).Length -le 0) {
    throw 'The database backup file is empty.'
  }

  & $pgRestore --list $backupFile *> $null
  if ($LASTEXITCODE -ne 0) { throw 'The backup archive failed its integrity check.' }

  $backupSizeMb = [Math]::Round((Get-Item -LiteralPath $backupFile).Length / 1MB, 2)
  "[$(Get-Date -Format s)] Backup verified: $([IO.Path]::GetFileName($backupFile)) ($backupSizeMb MB)." | Add-Content -LiteralPath $backupLog

  $resolvedBackupRoot = [IO.Path]::GetFullPath($backupRoot).TrimEnd('\') + '\'
  $retentionCutoff = (Get-Date).AddDays(-14)
  Get-ChildItem -LiteralPath $backupRoot -Filter 'type-arena-*.dump' -File |
    Where-Object { $_.LastWriteTime -lt $retentionCutoff } |
    ForEach-Object {
      $resolvedFile = [IO.Path]::GetFullPath($_.FullName)
      if ($resolvedFile.StartsWith($resolvedBackupRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedFile
        "[$(Get-Date -Format s)] Removed expired backup: $($_.Name)." | Add-Content -LiteralPath $backupLog
      }
    }
} catch {
  "[$(Get-Date -Format s)] Backup failed: $($_.Exception.Message)" | Add-Content -LiteralPath $backupLog
  if (Test-Path -LiteralPath $backupFile) {
    $resolvedBackupRoot = [IO.Path]::GetFullPath($backupRoot).TrimEnd('\') + '\'
    $resolvedBackupFile = [IO.Path]::GetFullPath($backupFile)
    if ($resolvedBackupFile.StartsWith($resolvedBackupRoot, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedBackupFile
    }
  }
  throw
} finally {
  if ($pushedLocation) { Pop-Location }
  $env:PGPASSWORD = $previousPgPassword
}
