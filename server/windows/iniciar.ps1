# Telinha — servidor de TESTE direto no Windows, sem Docker.
#
# Sobe o LiveKit, o servidor de tokens e o Caddy (HTTPS) usando o mesmo
# server\.env do Docker. Na primeira vez baixa o livekit-server.exe e o
# caddy.exe oficiais (versões fixas) para server\windows\bin\.
#
# Uso (PowerShell, na pasta server\windows):
#   .\iniciar.ps1           # completo: acessível de fora (DuckDNS + HTTPS)
#   .\iniciar.ps1 -Local    # só neste PC, pra testar com `npm run dev`
# Parar: Ctrl+C
#
# Antes, uma vez (como administrador): .\liberar-firewall.ps1

param(
  [switch]$Local,
  [string]$EnvFile
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Split-Path -Parent $here
$bin = Join-Path $here "bin"
if (-not $EnvFile) { $EnvFile = Join-Path $server ".env" }

$LIVEKIT_VERSION = "1.13.11"
$CADDY_VERSION = "2.8.4"
$utf8 = New-Object System.Text.UTF8Encoding $false

function New-Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  ($b | ForEach-Object { $_.ToString("x2") }) -join ""
}

# ---------- .env (cria na primeira vez, igual ao setup.sh) ----------
if (-not (Test-Path $EnvFile)) {
  Write-Host "Criando $EnvFile ..." -ForegroundColor Cyan
  $sub = Read-Host "Subdomínio do DuckDNS (ex.: telinha)"
  $duck = Read-Host "Token do DuckDNS"
  $lines = [System.IO.File]::ReadAllLines((Join-Path $server ".env.example"), $utf8) | ForEach-Object {
    $_ -replace '^DOMAIN=.*', "DOMAIN=$sub.duckdns.org" `
       -replace '^DUCKDNS_SUBDOMAIN=.*', "DUCKDNS_SUBDOMAIN=$sub" `
       -replace '^DUCKDNS_TOKEN=.*', "DUCKDNS_TOKEN=$duck" `
       -replace '^LIVEKIT_API_KEY=.*', ("LIVEKIT_API_KEY=API" + (New-Secret 6)) `
       -replace '^LIVEKIT_API_SECRET=.*', ("LIVEKIT_API_SECRET=" + (New-Secret 32))
  }
  [System.IO.File]::WriteAllLines($EnvFile, $lines, $utf8)
}

$cfg = @{}
foreach ($line in [System.IO.File]::ReadAllLines($EnvFile, $utf8)) {
  if ($line -match '^\s*([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2].Trim() }
}
foreach ($k in "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DOMAIN") {
  if (-not $cfg[$k]) { throw "Falta $k no $EnvFile" }
}
if (-not $cfg["MAX_PARTICIPANTS"]) { $cfg["MAX_PARTICIPANTS"] = "6" }
if (-not $cfg["MAX_QUALITY"]) { $cfg["MAX_QUALITY"] = "1080" }
if (-not $cfg["VOICE_ENABLED"]) { $cfg["VOICE_ENABLED"] = "false" }

# ---------- Programas (baixa uma vez) ----------
function Get-Tool([string]$name, [string]$url, [string]$exe) {
  $path = Join-Path $bin $exe
  if (Test-Path $path) { return $path }
  New-Item -ItemType Directory -Force $bin | Out-Null
  $zip = Join-Path $bin "$name.zip"
  $tmp = Join-Path $bin "$name-tmp"
  Write-Host "Baixando $name ($url) ..." -ForegroundColor Cyan
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
  Expand-Archive -Force -Path $zip -DestinationPath $tmp
  Copy-Item (Join-Path $tmp $exe) $path
  Remove-Item -Recurse -Force $tmp, $zip
  return $path
}

$livekit = Get-Tool "livekit" "https://github.com/livekit/livekit/releases/download/v$LIVEKIT_VERSION/livekit_${LIVEKIT_VERSION}_windows_amd64.zip" "livekit-server.exe"
if (-not $Local) {
  $caddy = Get-Tool "caddy" "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION/caddy_${CADDY_VERSION}_windows_amd64.zip" "caddy.exe"
}

$tokenDir = Join-Path $server "token"
if (-not (Test-Path (Join-Path $tokenDir "node_modules"))) {
  Write-Host "Instalando dependências do servidor de tokens ..." -ForegroundColor Cyan
  Push-Location $tokenDir
  npm install --omit=dev --no-audit --no-fund | Out-Host
  Pop-Location
}

# ---------- Configuração do LiveKit (a mesma do docker-compose.yml) ----------
# -Local: sem descobrir IP público e sem TURN (tudo dentro deste PC)
$externalIp = if ($Local) { "false" } else { "true" }
$turn = if ($Local) { "" } else {
@"
turn:
  enabled: true
  domain: $($cfg["DOMAIN"])
  udp_port: 3478
  relay_range_start: 30000
  relay_range_end: 30100
"@
}
$env:LIVEKIT_CONFIG = @"
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: $externalIp
keys:
  $($cfg["LIVEKIT_API_KEY"]): $($cfg["LIVEKIT_API_SECRET"])
room:
  auto_create: false
  max_participants: $($cfg["MAX_PARTICIPANTS"])
  empty_timeout: 300
$turn
logging:
  level: info
"@

# Variáveis do servidor de tokens e do Caddy
$env:PORT = "3001"
$env:LIVEKIT_HOST = "http://127.0.0.1:7880"
$env:LIVEKIT_API_KEY = $cfg["LIVEKIT_API_KEY"]
$env:LIVEKIT_API_SECRET = $cfg["LIVEKIT_API_SECRET"]
$env:MAX_PARTICIPANTS = $cfg["MAX_PARTICIPANTS"]
$env:MAX_QUALITY = $cfg["MAX_QUALITY"]
$env:VOICE_ENABLED = $cfg["VOICE_ENABLED"]
$env:DOMAIN = $cfg["DOMAIN"]

# ---------- Sobe tudo ----------
$procs = @()
$procs += Start-Process -FilePath $livekit -NoNewWindow -PassThru
$procs += Start-Process -FilePath "node" -ArgumentList "index.ts" -WorkingDirectory $tokenDir -NoNewWindow -PassThru
if (-not $Local) {
  $procs += Start-Process -FilePath $caddy -ArgumentList "run", "--config", (Join-Path $server "Caddyfile"), "--adapter", "caddyfile" -NoNewWindow -PassThru
}

Write-Host ""
if ($Local) {
  Write-Host "Servidor LOCAL rodando. No site (npm run dev), use um .env.local com:" -ForegroundColor Green
  Write-Host "  VITE_LIVEKIT_URL=ws://localhost:7880"
  Write-Host "  VITE_TOKEN_URL=http://localhost:3001/token"
} else {
  Write-Host "Servidor rodando em https://$($cfg["DOMAIN"])  (teste: https://$($cfg["DOMAIN"])/api/health)" -ForegroundColor Green
}
Write-Host "Ctrl+C para parar." -ForegroundColor Green

try {
  while ($true) {
    if (-not $Local -and $cfg["DUCKDNS_SUBDOMAIN"] -and $cfg["DUCKDNS_TOKEN"]) {
      try {
        $r = Invoke-WebRequest -UseBasicParsing "https://www.duckdns.org/update?domains=$($cfg["DUCKDNS_SUBDOMAIN"])&token=$($cfg["DUCKDNS_TOKEN"])&ip="
        Write-Host "DuckDNS: $($r.Content)"
      } catch {
        Write-Host "DuckDNS: falhou ($($_.Exception.Message))" -ForegroundColor Yellow
      }
    }
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 5
      foreach ($p in $procs) {
        if ($p.HasExited) { throw "Um dos programas parou (PID $($p.Id), código $($p.ExitCode)). Veja as mensagens acima." }
      }
    }
  }
} finally {
  Write-Host "Parando ..." -ForegroundColor Cyan
  foreach ($p in $procs) { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
}
