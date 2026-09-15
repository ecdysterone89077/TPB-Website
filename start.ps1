#Requires -Version 5.1
# start.ps1 - Full-stack TPB UNU Purwokerto (Windows + WSL)
# 1-klik: DB (WSL) -> deps -> prisma -> build API (tsc) -> run API (node dist) + Web (Vite) -> buka Chrome
# Jalankan: powershell -ExecutionPolicy Bypass -File ./start.ps1  atau  pnpm dev:all

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $ROOT

function Write-Step($msg) { Write-Host "`n== $msg ==" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

# 0) Pastikan pnpm di PATH
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
  $npmPrefix = (npm config get prefix 2>$null).Trim()
  if ($npmPrefix) {
    $candidate = Join-Path $npmPrefix "pnpm.cmd"
    if (Test-Path $candidate) {
      $env:Path += ";" + (Split-Path $candidate)
      $added = Split-Path $candidate
      Write-Warn ("pnpm tidak di PATH, ditambahkan: " + $added)
    }
  }
}
try { pnpm -v 2>$null | Out-Null } catch { Write-Error "pnpm tidak ditemukan. Install: npm i -g pnpm@9.15.0"; exit 1 }
$pnpmVer = (pnpm -v).Trim()
$nodeVer = (node -v).Trim()
Write-Ok ("pnpm " + $pnpmVer + " | node " + $nodeVer)

# 1) WSL keepalive - cegah distro idle mati
Write-Step "WSL keepalive"
$wslRunning = (wsl.exe -l -v 2>$null | Out-String) -match "Ubuntu.*Running"
if (-not $wslRunning) { Write-Host "  WSL Ubuntu sedang start..." }
try {
  Start-Process -FilePath "wsl.exe" -ArgumentList @("-d","Ubuntu","--","bash","-lc","sleep infinity") -WindowStyle Hidden -ErrorAction SilentlyContinue | Out-Null
  Write-Ok "keepalive sleep infinity (hidden)"
} catch {
  Write-Warn ("keepalive gagal, lanjut: " + $_)
}

# 2) Docker DB
Write-Step "Docker DB (tpb-mysql)"
$composeFile = Join-Path $ROOT "docker-compose.yml"
if (Test-Path $composeFile) {
  $wslRoot = $ROOT -replace "^C:", "/mnt/c" -replace "\\", "/"
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  wsl.exe -d Ubuntu -- bash -lc "cd '$wslRoot' && docker compose up -d db 2>/dev/null" 2>$null | Out-Null
  $ErrorActionPreference = $prevPref
}
$deadline = (Get-Date).AddSeconds(60)
$healthy = $false
while ((Get-Date) -lt $deadline) {
  $status = (wsl.exe -d Ubuntu -- bash -lc "docker inspect tpb-mysql --format '{{.State.Health.Status}}' 2>/dev/null" 2>$null).Trim()
  if ($status -eq "healthy") { $healthy = $true; break }
  Write-Host ("  DB status: " + $status + " - tunggu 3s...")
  Start-Sleep -Seconds 3
}
if (-not $healthy) { Write-Warn "DB belum healthy setelah 60s, lanjut coba..." } else { Write-Ok "DB healthy" }

# 3) .env - copy dari .example jika belum ada + generate JWT secret
Write-Step "Env"
$apiEnv = Join-Path $ROOT "apps/api/.env"
$apiExample = Join-Path $ROOT "apps/api/.env.example"
$webEnv = Join-Path $ROOT "apps/web/.env"
$webExample = Join-Path $ROOT "apps/web/.env.example"
if (-not (Test-Path $apiEnv)) {
  Copy-Item $apiExample $apiEnv
  Write-Ok "apps/api/.env dibuat dari .env.example"
}
if ((Get-Content $apiEnv -Raw) -match "replace-with-at-least") {
  $secret = ""
  try {
    $secret = (openssl rand -hex 48 2>$null).Trim()
  } catch {}
  if (-not $secret -or $secret.Length -lt 64) {
    $secret = ([System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")).Substring(0,96)
  }
  (Get-Content $apiEnv -Raw) -replace "replace-with-at-least-64-random-hex-chars", $secret | Set-Content $apiEnv -NoNewline
  Write-Ok "JWT_ACCESS_SECRET digenerate"
}
if (-not (Test-Path $webEnv)) { Copy-Item $webExample $webEnv; Write-Ok "apps/web/.env dibuat" }

# 3b) Bersihkan port dulu sebelum prisma:generate (hindari EPERM file lock)
Write-Step "Bersihkan port 3000/5173 (pre)"
foreach ($port in @(3000,5173)) {
  $lines = netstat -ano | Select-String ":$port\s"
  $pidsToKill = @()
  foreach ($line in $lines) {
    if ($line.ToString() -match "LISTENING\s+(\d+)\s*$") { $pidsToKill += $matches[1] }
  }
  $pidsToKill = $pidsToKill | Sort-Object -Unique
  foreach ($targetPid in $pidsToKill) {
    try { Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Start-Sleep -Seconds 1

# 4) Deps
Write-Step "Deps"
if (-not (Test-Path (Join-Path $ROOT "node_modules"))) {
  Write-Host "  pnpm install..."
  pnpm install
  if ($LASTEXITCODE -ne 0) { Write-Error "pnpm install gagal"; exit 1 }
  Write-Ok "install selesai"
} else {
  Write-Ok "node_modules sudah ada (skip, hapus folder untuk reinstall paksa)"
}

# 4b) Build kontrak bersama - API me-resolve @tpb/contracts ke packages/contracts/dist
Write-Step "Build contracts"
pnpm --filter @tpb/contracts build
if ($LASTEXITCODE -ne 0) { Write-Error "build contracts gagal"; exit 1 }
Write-Ok "contracts dist built"

# 5) Prisma
Write-Step "Prisma"
pnpm --filter @tpb/api prisma:generate
if ($LASTEXITCODE -ne 0) { Write-Error "prisma:generate gagal"; exit 1 }
pnpm --filter @tpb/api prisma:deploy
if ($LASTEXITCODE -ne 0) { Write-Warn "prisma:deploy ada issue, coba lanjut..." } else { Write-Ok "migrate deploy OK" }

# 6) Build API (wajib - hindari bug tsx DI di Node 24, pakai node dist)
Write-Step "Build API (tsc)"
pnpm --filter @tpb/api build
if ($LASTEXITCODE -ne 0) { Write-Error "build API gagal"; exit 1 }
Write-Ok "api dist built"

# 7) Bebaskan port 3000 & 5173
Write-Step "Bersihkan port 3000/5173"
foreach ($port in @(3000,5173)) {
  $lines = netstat -ano | Select-String ":$port\s"
  $pidsToKill = @()
  foreach ($line in $lines) {
    if ($line.ToString() -match "LISTENING\s+(\d+)\s*$") { $pidsToKill += $matches[1] }
  }
  $pidsToKill = $pidsToKill | Sort-Object -Unique
  foreach ($targetPid in $pidsToKill) {
    try {
      $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
      $name = if ($proc) { $proc.ProcessName } else { "?" }
      Write-Host ("  kill :" + $port + " PID " + $targetPid + " (" + $name + ")") -ForegroundColor Yellow
      Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
    } catch {}
  }
}
Start-Sleep -Seconds 1

# 8) Start API (node dist) + Web (vite dev) - log ke TEMP
Write-Step "Start API + Web"
$apiLog = Join-Path $env:TEMP "tpb-api.log"
$webLog = Join-Path $env:TEMP "tpb-web.log"
$apiErrLog = $apiLog + ".err"
$webErrLog = $webLog + ".err"
Remove-Item $apiLog -ErrorAction SilentlyContinue
Remove-Item $apiErrLog -ErrorAction SilentlyContinue
Remove-Item $webLog -ErrorAction SilentlyContinue
Remove-Item $webErrLog -ErrorAction SilentlyContinue

$apiProc = Start-Process -FilePath "node" -ArgumentList @("apps/api/dist/main.js") -WorkingDirectory $ROOT -WindowStyle Hidden -RedirectStandardOutput $apiLog -RedirectStandardError $apiErrLog -PassThru
Write-Ok ("API pid " + $apiProc.Id + " -> " + $apiLog)
# Web via cmd.exe agar output child Vite tertangkap (pnpm -> vite)
$webLogQuoted = '"' + $webLog + '"'
$webProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "pnpm --filter @tpb/web dev > $webLogQuoted 2>&1") -WorkingDirectory $ROOT -WindowStyle Hidden -PassThru
Write-Ok ("Web pid " + $webProc.Id + " -> " + $webLog + " (via cmd)")

# 9) Tunggu + health check
Write-Step "Health check"
$deadline = (Get-Date).AddSeconds(45)
$apiUp = $false
$webUp = $false
while ((Get-Date) -lt $deadline) {
  try { $h = Invoke-RestMethod -Uri "http://localhost:3000/v1/health" -TimeoutSec 2 -ErrorAction Stop; if ($h.ok -eq $true) { $apiUp = $true } } catch {}
  try { $w = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($w.StatusCode -eq 200) { $webUp = $true } } catch {}
  if ($apiUp -and $webUp) { break }
  Start-Sleep -Seconds 2
}
if ($apiUp) { Write-Ok "API http://localhost:3000/v1/health -> ok" } else { Write-Warn ("API belum ok, cek " + $apiLog); if (Test-Path $apiLog) { Get-Content $apiLog -Tail 40 | Write-Host -ForegroundColor Yellow }; if (Test-Path $apiErrLog) { Get-Content $apiErrLog -Tail 40 | Write-Host -ForegroundColor Yellow } }
if ($webUp) { Write-Ok "Web http://localhost:5173/ -> 200" } else { Write-Warn ("Web belum 200, cek " + $webLog); if (Test-Path $webLog) { Get-Content $webLog -Tail 40 | Write-Host -ForegroundColor Yellow }; if (Test-Path $webErrLog) { Get-Content $webErrLog -Tail 40 | Write-Host -ForegroundColor Yellow } }

# 10) Buka Chrome
Write-Step "Buka Chrome"
$chromeCandidates = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
  Start-Process -FilePath $chrome -ArgumentList @("http://localhost:5173") | Out-Null
  Write-Ok "Chrome dibuka -> http://localhost:5173"
} else {
  Start-Process "http://localhost:5173" | Out-Null
  Write-Ok "Browser default dibuka -> http://localhost:5173"
}
Write-Host ""
Write-Host ("Log: " + $apiLog + " | " + $webLog) -ForegroundColor DarkGray
Write-Host "Stop: .\stop.ps1  atau  pnpm dev:stop" -ForegroundColor DarkGray
Write-Host "Cek manual: curl http://localhost:3000/v1/health  &  curl http://localhost:3000/v1/content" -ForegroundColor DarkGray
Write-Host ""
