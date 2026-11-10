function Get-TypeArenaDatabaseConnection {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentFilePath
  )

  if (-not (Test-Path -LiteralPath $EnvironmentFilePath -PathType Leaf)) {
    throw 'The local server environment file is missing.'
  }

  $databaseUrlLine = Get-Content -LiteralPath $EnvironmentFilePath |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -Last 1
  if ([string]::IsNullOrWhiteSpace($databaseUrlLine)) {
    throw 'DATABASE_URL is missing from the local server environment file.'
  }

  $databaseUrl = $databaseUrlLine -replace '^\s*DATABASE_URL\s*=\s*', ''
  $databaseUrl = $databaseUrl.Trim()
  if ($databaseUrl.Length -ge 2 -and (($databaseUrl[0] -eq '"' -and $databaseUrl[$databaseUrl.Length - 1] -eq '"') -or ($databaseUrl[0] -eq "'" -and $databaseUrl[$databaseUrl.Length - 1] -eq "'"))) {
    $databaseUrl = $databaseUrl.Substring(1, $databaseUrl.Length - 2)
  } else {
    $commentIndex = $databaseUrl.IndexOf(' #', [StringComparison]::Ordinal)
    if ($commentIndex -ge 0) { $databaseUrl = $databaseUrl.Substring(0, $commentIndex).TrimEnd() }
  }

  try { $uri = [Uri]$databaseUrl } catch { throw 'DATABASE_URL is not a valid connection URL.' }
  if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'postgres' -and $uri.Scheme -ne 'postgresql') {
    throw 'DATABASE_URL must use a PostgreSQL connection URL.'
  }

  $escapedUserInfo = $uri.GetComponents([UriComponents]::UserInfo, [UriFormat]::UriEscaped)
  $separator = $escapedUserInfo.IndexOf(':')
  if ($separator -lt 1) { throw 'DATABASE_URL must include the local database user and password.' }
  $databasePort = $uri.Port
  if ($databasePort -le 0) { $databasePort = 5432 }

  return [PSCustomObject]@{
    Host = $uri.Host
    Port = [string]$databasePort
    User = [Uri]::UnescapeDataString($escapedUserInfo.Substring(0, $separator))
    Password = [Uri]::UnescapeDataString($escapedUserInfo.Substring($separator + 1))
    Database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  }
}
