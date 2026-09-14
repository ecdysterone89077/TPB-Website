#Requires -Version 5.1
# stop.ps1 — matikan stack TPB (API :3000, Web :5173)
$ErrorActionPreference = "SilentlyContinue"
Write-Host "Stop TPB stack..." -ForegroundColor Cyan
foreach ($port in @(3000,5173)) {
  # pakai netstat (lebih andal tanpa admin vs Get-NetTCPConnection)
  $lines = netstat -ano | Select-String ":$port\s"
  $pids = @()
  foreach ($line in $lines) {
    if ($line.ToString() -match "LISTENING\s+(\d+)\s*$") { $pids += $matches[1] }
  }
  $pids = $pids | Sort-Object -Unique
  if ($pids.Count -gt 0) {
    foreach ($targetPid in $pids) {
      try {
        $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "?" }
        Write-Host "  kill :$port PID $targetPid ($name)" -ForegroundColor Yellow
        Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
      } catch {}
    }
  } else {
    Write-Host "  :$port sudah kosong" -ForegroundColor DarkGray
  }
}
Start-Sleep -Seconds 1
$remain = netstat -ano | Select-String ":3000\s|:5173\s" | Select-String "LISTENING"
if (-not $remain) { Write-Host "Selesai - port bersih." -ForegroundColor Green } else { Write-Host "Sisa:" -ForegroundColor Yellow; $remain | ForEach-Object { Write-Host "  $_" } }
