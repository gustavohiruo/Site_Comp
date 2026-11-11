# Libera no Firewall do Windows as portas do servidor do Telinha.
# Rode UMA vez, no PowerShell aberto como ADMINISTRADOR:
#   .\liberar-firewall.ps1
# Pra desfazer:
#   Remove-NetFirewallRule -DisplayName "Telinha*"
#Requires -RunAsAdministrator

New-NetFirewallRule -DisplayName "Telinha TCP (HTTPS e mídia)" -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort 80, 443, 7881 | Out-Null
New-NetFirewallRule -DisplayName "Telinha UDP (mídia e TURN)" -Direction Inbound -Action Allow `
  -Protocol UDP -LocalPort 7882, 3478, "30000-30100" | Out-Null

Write-Host "Portas liberadas: TCP 80, 443, 7881 | UDP 7882, 3478, 30000-30100" -ForegroundColor Green
