# Telinha

Compartilhamento de tela pra você e seus amigos: várias telas ao mesmo tempo, e cada um escolhe qual assistir. É leve pra rodar junto com o jogo.

- **Site:** publicado no GitHub Pages, sem instalar nada.
- **Servidor:** seu, rodando em casa ou numa VM da Oracle. O site **sempre** se conecta por `telinha.duckdns.org`, então trocar de servidor é só mudar o IP no DuckDNS.
- **Chat de voz:** pronto, mas **desligado** por uma chave no `.env` (veja [Ligar a voz](#ligar-o-chat-de-voz)).
- **App desktop (Tauri):** guardado em [`desktop/`](desktop/) (veja [Retomar o app](#retomar-o-app-desktop)).

## O que dá pra fazer

- **Todo mundo pode compartilhar a tela,** inclusive várias pessoas ao mesmo tempo. A barra "Telas ao vivo" mostra quem está transmitindo e você clica em quem quer assistir.
- **Som da tela:** escolhendo **Tela inteira** e marcando **Compartilhar áudio do sistema**, o som do jogo ou do vídeo vai junto. Quem assiste clica em **Ativar som**.
  - Compartilhando **uma aba**, vai o som daquela aba.
  - Compartilhando **uma janela**, vai sem som (limitação do Chrome no Windows).
- **2 versões de cada tela (simulcast):** a cheia e uma leve. Quem tem internet fraca, ou está com o vídeo pequeno, recebe a leve, e o botão **Leve** força isso.
  - **Tela que ninguém assiste não gasta seu upload:** o envio pausa sozinho (dynacast).
- **Limites:**
  - **Qualidade máxima** definida pelo servidor (`MAX_QUALITY`).
  - **Limite pessoal** de cada um, em Configurações.
  - **Máximo de pessoas** por sala (`MAX_PARTICIPANTS`).
- **Contador de tráfego do mês,** medido no navegador de cada um.
- **Salas com senha opcional.**

## Como funciona

```
Navegador ──wss (443)──► Caddy ──► LiveKit (SFU)   ◄── telas: UDP 7882 / TCP 7881
                           └──► Servidor de tokens (cria sala, senha, regras)
       telinha.duckdns.org aponta pro IP da máquina que estiver rodando o servidor
```

Cada pessoa envia sua tela **uma vez** pro servidor, e ele distribui. Cada um só baixa a tela que está assistindo.

## Configuração do servidor (`server/.env`)

Toda a configuração fica nesse arquivo. Nada de IP ou domínio no código.

| Variável | Padrão | O que faz |
|---|---|---|
| `DOMAIN` | `telinha.duckdns.org` | Endereço do servidor |
| `DUCKDNS_SUBDOMAIN` / `DUCKDNS_TOKEN` | — | Mantém o DuckDNS com o IP atual |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | geradas | Chaves secretas (não compartilhe) |
| `MAX_PARTICIPANTS` | `6` | Máximo de pessoas por sala |
| `MAX_QUALITY` | `1080` | Qualidade máxima das telas: `720`, `1080` ou `1440` |
| `VOICE_ENABLED` | `false` | Chat de voz ligado ou desligado |

Depois de mudar o `.env`, reinicie: `docker compose up -d` (no Windows, pare e rode o `iniciar.ps1` de novo).

### Quanto de internet o servidor usa

O servidor envia **cada tela para cada pessoa que está assistindo**. A conta aproximada do upload dele é:

> **upload do servidor ≈ (pessoas assistindo) × (qualidade)**
> 720p ≈ 6 Mbps · 1080p ≈ 15 Mbps · 1440p ≈ 28 Mbps (por pessoa)

Com os seus ~170 Mbps de upload:

| `MAX_QUALITY` | 6 pessoas | 10 pessoas |
|---|---|---|
| 720 | ~36 Mbps | ~60 Mbps |
| **1080** | **~90 Mbps** | ~150 Mbps |
| 1440 | ~170 Mbps (no limite) | ~280 Mbps ❌ |

Quem transmite gasta o mesmo upload não importa quantos assistam: as 2 versões da tela, ~17,5 Mbps em 1080p. O limite de qualidade é respeitado pelo site; entre amigos, isso basta.

### Ligar o chat de voz

1. No `server/.env`, troque para `VOICE_ENABLED=true`.
2. Reinicie o servidor.

Não precisa republicar o site: ele recebe a chave junto com o token de entrada.

- **Voz ligada:** microfone, mudo, "silenciar todo mundo", volume por pessoa e anel de quem fala.
- **Voz desligada:** o site **não pede microfone**, esconde esses controles e o servidor **nem permite** publicar microfone (o token só libera tela e som da tela).

---

## Guia A: subir o servidor no PC de casa

### Qual sistema usar?

- **Pra testar agora, no seu PC principal (Windows): use os scripts sem Docker,** na seção [A1](#a1-teste-no-windows-sem-docker).
- **Pro mini servidor definitivo: Ubuntu Server com Docker,** na seção [A2](#a2-mini-servidor-com-ubuntu-server--docker).
- **Por que não Docker Desktop no Windows?** Ele roda os contêineres dentro de uma máquina virtual (WSL2), e o tráfego UDP passa por uma camada extra de NAT. O modo `network_mode: host`, que o LiveKit precisa, não funciona direito lá. Na prática a página carrega, mas o vídeo não conecta ou fica instável.

### A1. Teste no Windows (sem Docker)

Precisa do **Node.js 24 ou mais novo** (https://nodejs.org).

1. **Libere o firewall** (uma vez). Abra o PowerShell **como administrador**:
   ```powershell
   cd C:\caminho\do\projeto\server\windows
   Set-ExecutionPolicy -Scope Process Bypass
   .\liberar-firewall.ps1
   ```
2. **Suba o servidor** (PowerShell normal):
   ```powershell
   cd C:\caminho\do\projeto\server\windows
   Set-ExecutionPolicy -Scope Process Bypass
   .\iniciar.ps1
   ```
   - **Primeira vez:** ele pergunta o subdomínio e o token do DuckDNS, cria o `server\.env` com chaves novas e baixa o LiveKit e o Caddy oficiais.
   - **Para parar:** **Ctrl+C**.
   - **Só neste PC** (sem DuckDNS nem HTTPS, pra desenvolver com `npm run dev`): `.\iniciar.ps1 -Local`.
   - **Portas 80 e 443 livres:** no modo completo, o Caddy precisa delas. Se outro programa já usa alguma (IIS, XAMPP, Apache), feche esse programa antes.
3. Siga a partir do passo **"Fixar o IP interno"**, abaixo. Roteador, portas, DuckDNS e teste valem igual.

O servidor roda no mesmo PC em que você joga. Por isso o padrão é 6 pessoas e 1080p. Quando passar pro mini servidor, suba pra 10.

### A2. Mini servidor com Ubuntu Server + Docker

1. **Instalar o Ubuntu Server 24.04 LTS** (https://ubuntu.com/download/server):
   - Grave num pendrive com o **balenaEtcher** ou o **Rufus** e dê boot por ele.
   - No instalador: rede em DHCP, **"Use an entire disk"** (apaga o disco!), crie usuário e senha e marque **"Install OpenSSH server"**.
2. **Instalar o Docker** (pelo SSH, do seu PC: `ssh usuario@IP-do-servidor`):
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   exit        # saia e entre de novo pra valer
   ```
3. **Baixar o projeto e configurar:**
   ```bash
   git clone https://github.com/SEU-USUARIO/telinha.git
   cd telinha/server
   bash setup.sh                  # pergunta o DuckDNS e gera o .env com chaves novas
   nano .env                      # (opcional) MAX_PARTICIPANTS, MAX_QUALITY, VOICE_ENABLED
   docker compose up -d --build
   docker compose logs -f         # Ctrl+C sai dos logs (o servidor continua)
   ```
   Os contêineres voltam sozinhos quando o PC reinicia.

### Fixar o IP interno do PC no roteador

O encaminhamento de portas aponta pra um IP **dentro** de casa. Se esse IP mudar, quebra.

1. **Descubra o IP e o MAC do PC servidor:**
   - **Windows:** `ipconfig /all` (veja "Endereço IPv4" e "Endereço Físico").
   - **Ubuntu:** `ip addr`.
2. Entre na página do roteador (geralmente http://192.168.0.1 ou http://192.168.15.1; a senha costuma estar na etiqueta dele).
3. Procure **"Reserva de DHCP"**, **"DHCP estático"** ou **"IP fixo"** e associe o MAC do PC ao IP dele.

### Abrir as portas no roteador

Em **"Encaminhamento de portas"**, **"Port forwarding"** ou **"Virtual server"**, aponte tudo pro IP fixo do PC:

| Porta | Protocolo | Para quê |
|---|---|---|
| 80 | TCP | Certificado HTTPS automático (Let's Encrypt) |
| 443 | TCP | Site falando com o servidor (wss) |
| 7881 | TCP | Telas por TCP (redes que bloqueiam UDP) |
| 7882 | **UDP** | **Telas (o principal)** |
| 3478 | **UDP** | TURN |
| 30000–30100 | **UDP** | TURN (repasse) |

**Ubuntu com firewall `ufw` ligado:**
```bash
sudo ufw allow 80,443,7881/tcp
sudo ufw allow 7882,3478/udp
sudo ufw allow 30000:30100/udp
```

### Configurar o DuckDNS (e manter o IP atualizado)

1. Entre em https://www.duckdns.org (login com GitHub ou Google).
2. Crie o subdomínio **`telinha`**. Se já for de outra pessoa, escolha outro nome e troque em dois lugares: no `server/.env` e na variável `SERVER_URL` do GitHub (seção [Publicar o site](#publicar-o-site-github-pages)).
3. Copie o **token** (no topo da página). O `setup.sh` ou o `iniciar.ps1` pedem ele.

**Atualização automática:**
- **No Docker,** o contêiner `duckdns` avisa o DuckDNS do IP atual a cada 5 minutos.
- **No Windows,** o `iniciar.ps1` faz o mesmo enquanto estiver rodando.

Quando a operadora trocar seu IP, o endereço acompanha sozinho.

### CGNAT: confira antes de tudo

Com **CGNAT**, ninguém de fora chega no seu roteador, e abrir porta não adianta. Para conferir:

1. Veja o **IP WAN** na página do roteador.
2. Compare com https://meuip.com.br.
3. **Iguais:** tudo certo. **Diferentes,** ou começando com `100.64` a `100.127`: é CGNAT. Peça "IP público" ou "IP válido" à operadora, ou use a Oracle (Guia B).

### Testar se está acessível de fora de casa

Teste **de fora da sua rede**. Dentro de casa às vezes funciona mesmo com a porta fechada.

1. **No celular, com Wi-Fi desligado (4G/5G),** abra `https://telinha.duckdns.org/api/health`. Tem que aparecer `{"ok":true}`. Se aparecer, o DuckDNS, a porta 443 e o HTTPS estão certos.
2. **Ainda no 4G,** abra o site, entre numa sala que você criou no PC e **compartilhe a tela no PC**. Se a tela aparecer no celular, as portas de mídia (UDP 7882 ou TCP 7881) estão certas.
3. **Se o passo 1 funcionar e o 2 não,** a porta **UDP 7882** ou a **TCP 7881** não está encaminhada.
4. **Peça pra um amigo entrar** da casa dele.

Se **o seu próprio navegador**, no mesmo PC ou na mesma casa do servidor, não conectar mas os amigos de fora conectarem, o roteador não suporta "loopback NAT". Me avise que a gente contorna.

---

## Guia B: migrar para a Oracle Cloud (Ampere ARM, São Paulo)

Todas as imagens funcionam em ARM64, e o `.env` é o mesmo. O site não muda nada.

1. **Criar a conta** em https://www.oracle.com/cloud/free/:
   - Escolha **Brazil East (São Paulo)** como região principal. **Não dá pra trocar depois.**
   - O cartão é só pra verificação.
2. **Criar a VM** (Compute → Instances → Create instance):
   - **Image:** Canonical **Ubuntu 24.04** (aarch64).
   - **Shape:** **VM.Standard.A1.Flex** (Ampere), por exemplo 2 OCPUs e 12 GB. O plano Always Free cobre até 4 OCPUs e 24 GB no total.
   - **Networking:** marque **"Assign a public IPv4 address"**.
   - **SSH keys:** baixe a chave privada que ele gerar (ou envie a sua).
   - Se der **"Out of capacity"**, tente de novo mais tarde ou em outro "availability domain". É comum nas máquinas grátis.
3. **Liberar as portas na Security List** (na VCN da instância: Subnet → Security List → Add Ingress Rules). Crie regras com origem `0.0.0.0/0`:
   - **TCP**, portas `80`, `443`, `7881`.
   - **UDP**, portas `7882`, `3478`, `30000-30100`.
4. **Liberar as portas também no iptables do Ubuntu.** As imagens da Oracle vêm com o iptables bloqueando quase tudo, então sem isso a Security List sozinha não basta:
   ```bash
   ssh -i chave.key ubuntu@IP-DA-VM
   sudo iptables -I INPUT -p tcp -m multiport --dports 80,443,7881 -j ACCEPT
   sudo iptables -I INPUT -p udp -m multiport --dports 7882,3478 -j ACCEPT
   sudo iptables -I INPUT -p udp --dport 30000:30100 -j ACCEPT
   sudo netfilter-persistent save
   ```
5. **Instalar o Docker e baixar o projeto** (igual ao Guia A2, passos 2 e 3, **sem** rodar o `setup.sh`):
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && exit
   # entre de novo pelo ssh
   git clone https://github.com/SEU-USUARIO/telinha.git
   ```
6. **Copiar o `.env`** do servidor de casa pra VM. Use o **mesmo** arquivo: mesmas chaves, mesmo DuckDNS.
   - **Do Ubuntu de casa:**
     ```bash
     scp -i chave.key ~/telinha/server/.env ubuntu@IP-DA-VM:~/telinha/server/.env
     ```
   - **Do Windows:**
     ```powershell
     scp -i chave.key C:\caminho\do\projeto\server\.env ubuntu@IP-DA-VM:~/telinha/server/.env
     ```
   Depois, se quiser, aumente o `MAX_PARTICIPANTS` pra 10 no `.env` da VM.
7. **Desligar o servidor de casa ANTES de subir a VM.** Se os dois ficarem ligados, os dois atualizam o DuckDNS e ficam brigando pelo endereço.
   - **Docker:** `docker compose down`.
   - **Windows:** Ctrl+C no `iniciar.ps1`.
8. **Subir na VM:**
   ```bash
   cd ~/telinha/server
   docker compose up -d --build
   ```
9. **Trocar o IP no DuckDNS:**
   - O contêiner `duckdns` faz isso sozinho em até 5 minutos.
   - Pra ser na hora: no site do DuckDNS, troque o IP de `telinha` pelo IP público da VM e clique em **update ip**.
10. **Testar** igual ao [teste de fora de casa](#testar-se-está-acessível-de-fora-de-casa).

O Caddy pega um certificado HTTPS novo sozinho na primeira vez. O plano grátis da Oracle inclui 10 TB de tráfego de saída por mês, o que é de sobra.

---

## Publicar o site (GitHub Pages)

1. Envie o código pro GitHub.
2. **Settings → Pages → Source → GitHub Actions**.
3. Se o seu subdomínio **não** for `telinha`: em **Settings → Secrets and variables → Actions → aba Variables**, crie `SERVER_URL` com o seu endereço (ex.: `meunome.duckdns.org`).
4. Faça um push. O site fica em `https://SEU-USUARIO.github.io/telinha/`.

Se um dia o endereço mudar e o site ainda não tiver sido republicado, cada pessoa pode colocar o endereço novo em **Configurações → Endereço do servidor** (botão no canto da tela inicial). Fica salvo só no navegador dela.

## Desenvolver localmente

1. **Servidor local:** `server\windows\iniciar.ps1 -Local`. Ele cria o `.env` se não existir; responda qualquer coisa no DuckDNS, que no modo local não é usado.
2. **Configuração do site:** crie `.env.local` na raiz com:
   ```
   VITE_LIVEKIT_URL=ws://localhost:7880
   VITE_TOKEN_URL=http://localhost:3001/token
   ```
3. **Rodar:** `npm install` e `npm run dev`, depois abra http://localhost:5173. Pra simular amigos, use janelas anônimas.

Se o campo **Configurações → Endereço do servidor** estiver preenchido nesse navegador, ele vale mais que o `.env.local`. Deixe em branco pra testar localmente.

## Dicas

- **Jogo em tela cheia exclusiva** pode aparecer preto. Use **janela sem bordas**.
- **Trocar a qualidade da sua tela** no meio da transmissão faz o vídeo piscar 1 ou 2 segundos pra quem assiste.
- **A aba do Telinha pode ficar escondida** enquanto você joga. Num teste de 6 minutos com a aba em segundo plano, o FPS enviado não caiu. Esse teste foi feito num Chrome de teste, que captura a 20 fps; com um jogo rodando de verdade ainda falta medir.
- **Modos beta 1440p · 120 e 240 fps:** aparecem na lista, mas **ficam sempre bloqueados** com este servidor. O `MAX_QUALITY` vai no máximo até 1440 a 60 fps. Pra liberar seria preciso uma opção a mais no servidor (ainda não existe).

## O que já foi testado e o que não foi

| Parte | Situação |
|---|---|
| Site + LiveKit + servidor de tokens rodando no Windows (`iniciar.ps1 -Local`) | ✅ Testado com 5 pessoas, 3 transmitindo ao mesmo tempo |
| Voz desligada (sem pedir microfone, token sem microfone) e voz religada pelo `.env` | ✅ Testado |
| Limite de qualidade do servidor, limite de pessoas, aba em segundo plano | ✅ Testado (aba escondida: a 20 fps, ver Dicas) |
| `docker-compose.yml` e `setup.sh` (Ubuntu) | ⚠️ Não testado (a configuração do LiveKit é a mesma da testada no Windows) |
| `iniciar.ps1` no modo completo (Caddy/HTTPS + DuckDNS) | ⚠️ Não testado |
| Acesso de fora de casa, roteador, portas | ⚠️ Depende da sua rede; siga o [teste de fora](#testar-se-está-acessível-de-fora-de-casa) |
| Guia B (Oracle) | ⚠️ Não testado |
| 60 fps e som da tela com um jogo de verdade | ⚠️ Não testado |

---

## Retomar o app desktop

O app está em [`desktop/`](desktop/) e **não faz parte do build do site**. A interface é a mesma.

**Como o código está organizado pra isso:**
- `src/core/`: núcleo sem React (sala, qualidade, limites, tráfego). O app usa sem mudar nada.
- `src/core/platform.ts`: **único** lugar que muda entre site e app.
- `npm run build:app` (na raiz): gera a interface pro app em `dist-app/`.

**Passo a passo:**
1. Tenha o Rust e o Visual Studio Build Tools com C++ (você já tem).
2. Na raiz: `npm install`.
3. Crie `.env` na raiz:
   ```
   VITE_SERVER_URL=telinha.duckdns.org
   VITE_PUBLIC_URL=https://SEU-USUARIO.github.io/telinha/
   ```
4. Rode:
   ```bash
   cd desktop
   npm install
   npm run dev      # abre o app
   npm run build    # instalador em desktop/src-tauri/target/release/bundle/nsis/
   ```

**Antes de retomar, saiba que:**
- O app ainda **não foi testado com o LiveKit**.
- A captura e a codificação nativas em Rust (GPU, NVENC ou AMF) **não foram feitas**. Isso fica pra se, depois de medir, o app pesar no jogo.
- A tag `app-tauri-v1` marca o ponto antes da separação: `git checkout app-tauri-v1`.

## Estrutura

```
src/
├── core/                 # núcleo sem React (reaproveitado pelo app)
│   ├── roomSession.ts    # sala no LiveKit: telas, simulcast, voz (opcional), limites
│   ├── prefs.ts          # limite de qualidade
│   ├── traffic.ts        # contador de tráfego do mês
│   ├── quality.ts        # presets de qualidade
│   ├── config.ts         # endereço do servidor
│   ├── platform.ts       # diferenças site × app
│   └── storage.ts, webrtc.ts
├── components/ pages/ hooks/
server/
├── docker-compose.yml    # LiveKit + tokens + Caddy + DuckDNS (x86 e ARM)
├── .env.example          # toda a configuração
├── setup.sh              # cria o .env (Linux)
├── Caddyfile
├── token/                # servidor de tokens (Node/TS)
└── windows/              # teste no Windows sem Docker
    ├── iniciar.ps1
    └── liberar-firewall.ps1
desktop/                  # app Tauri (guardado)
```
