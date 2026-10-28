# Keeps Windows out of idle sleep while this runs (the screen can still turn off), so unattended lanes, their keeper
# (`node scripts/lane.js keep`) and anything recording keep going overnight. The user's laptop sleeps after an hour idle
# on power, and nothing a lane runs asks it to stay up. No setting is changed: closing the window ends it. A closed lid
# still sleeps the laptop.
#
#   powershell -ExecutionPolicy Bypass -File scripts/keep-awake.ps1 [-Until "2026-10-28 12:00"]
#   (in a window of its own: cmd /c start "Keep awake" powershell -NoExit -ExecutionPolicy Bypass -File scripts\keep-awake.ps1)
param([string]$Until = "")

$Host.UI.RawUI.WindowTitle = 'Keep awake'
Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$end = if ($Until) { Get-Date $Until } else { [DateTime]::MaxValue }
Write-Host $(if ($Until) { "Keeping the PC awake until $end (close this window to stop sooner)." } else { "Keeping the PC awake until this window is closed." })
while ((Get-Date) -lt $end) {
  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED, renewed every minute
  if ([Win.Power]::SetThreadExecutionState([uint32]2147483649) -eq 0) { Write-Host "$(Get-Date -Format t)  Windows refused the keep-awake request" }
  Start-Sleep -Seconds 60
}
[Win.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null
Write-Host "$(Get-Date -Format t)  Normal sleep again. You can close this window."
