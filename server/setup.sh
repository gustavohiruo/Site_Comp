#!/usr/bin/env bash
# Cria o .env do servidor: pergunta o DuckDNS e gera as chaves secretas.
# Uso: bash setup.sh   (depois: docker compose up -d --build)
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo "Já existe um .env aqui. Renomeie ou apague esse arquivo se quiser configurar de novo."
  exit 1
fi

read -rp "Subdomínio do DuckDNS (ex.: telinha): " SUB
read -rp "Token do DuckDNS: " DUCK

KEY="API$(openssl rand -hex 6)"
SECRET="$(openssl rand -hex 32)"

sed -e "s|^DOMAIN=.*|DOMAIN=${SUB}.duckdns.org|" \
    -e "s|^DUCKDNS_SUBDOMAIN=.*|DUCKDNS_SUBDOMAIN=${SUB}|" \
    -e "s|^DUCKDNS_TOKEN=.*|DUCKDNS_TOKEN=${DUCK}|" \
    -e "s|^LIVEKIT_API_KEY=.*|LIVEKIT_API_KEY=${KEY}|" \
    -e "s|^LIVEKIT_API_SECRET=.*|LIVEKIT_API_SECRET=${SECRET}|" \
    .env.example > .env
chmod 600 .env

echo
echo "Pronto! Servidor: https://${SUB}.duckdns.org"
echo "Ajuste MAX_PARTICIPANTS, MAX_QUALITY e VOICE_ENABLED no .env se quiser."
echo "Agora rode: docker compose up -d --build"
