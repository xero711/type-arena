$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot 'backup-database.ps1'
$powerShellPath = (Get-Command pwsh -ErrorAction Stop).Source
$taskName = 'TYPE ARENA Database Backup'
$currentUser = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupScript`""
$trigger = New-ScheduledTaskTrigger -Daily -At '3:00AM'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 60) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Daily local TYPE ARENA PostgreSQL backup; keeps the latest 14 days.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
