# Keeps Windows out of idle sleep while this runs (the screen can still turn off), so unattended lanes, their keeper
# (`node scripts/lane.js keep`) and anything recording keep going overnight. The user's laptop sleeps after an hour idle
# on power, and nothing a lane runs asks it to stay up. No setting is changed: closing the window ends it. A closed lid
# still sleeps the laptop. -WhilePid ends it with that process: the keeper opens one for itself that way (minimized),
# since a window started by hand gets forgotten. On 2026-10-28 the night's ended at noon, and the PC slept from 4:12 to
# 5:49 PM while both lanes waited out a usage limit, the bot and the recorder frozen until a key woke it.
#
#   powershell -ExecutionPolicy Bypass -File scripts/keep-awake.ps1 [-Until "2026-10-28 12:00"] [-WhilePid <pid>]
#   (in a window of its own: cmd /c start "Keep awake" powershell -NoExit -ExecutionPolicy Bypass -File scripts\keep-awake.ps1)
param([string]$Until = "", [int]$WhilePid = 0)

$Host.UI.RawUI.WindowTitle = 'Keep awake'
Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$end = if ($Until) { Get-Date $Until } else { [DateTime]::MaxValue }
$running = { -not $WhilePid -or (Get-Process -Id $WhilePid -ErrorAction SilentlyContinue) }
Write-Host $(if ($WhilePid) { "Keeping the PC awake while process $WhilePid runs (close this window to stop sooner)." } elseif ($Until) { "Keeping the PC awake until $end (close this window to stop sooner)." } else { "Keeping the PC awake until this window is closed." })
while ((Get-Date) -lt $end -and (& $running)) {
  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED, renewed every minute
  if ([Win.Power]::SetThreadExecutionState([uint32]2147483649) -eq 0) { Write-Host "$(Get-Date -Format t)  Windows refused the keep-awake request" }
  Start-Sleep -Seconds 60
}
[Win.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null
Write-Host "$(Get-Date -Format t)  Normal sleep again. You can close this window."
