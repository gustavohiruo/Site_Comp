# Projeto: site de compartilhamento de tela (só eu e meus amigos)

## Objetivo
Criar um site simples para eu compartilhar a tela do PC com poucos amigos (até ~4–5), com a melhor fluidez possível (60fps, 1080p/1440p).

## Stack e hospedagem
- Front estático (Vite + React + TypeScript), hospedado no **GitHub Pages** (deploy via GitHub Actions).
- Sinalização com **PeerJS** (servidor público gratuito), sem backend próprio.
- WebRTC P2P: quem compartilha envia direto para cada espectador.
- STUN: `stun:stun.l.google.com:19302`. Deixar campo de config para adicionar TURN depois (ex.: Metered).

## Funcionalidades
1. Tela inicial: "Criar sala" (gera código aleatório) ou "Entrar na sala" (código + senha opcional).
2. Link compartilhável: `.../#/sala/<codigo>`.
3. Quem cria a sala é o host e tem o botão "Compartilhar tela"; os espectadores só assistem.
4. Seletor de qualidade: 720p60, 1080p60, 1440p60 e modo "Texto/Código" (contentHint "detail", 30fps).
5. Lista de quem está na sala, botão de tela cheia e indicador de FPS/bitrate (via `getStats`).
6. Espectador funciona no celular (só assistir).

## Configurações de qualidade (importante)
```js
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
  audio: true,
});
const track = stream.getVideoTracks()[0];
track.contentHint = "motion";
```
Depois de adicionar a track em cada RTCPeerConnection:
```js
const params = sender.getParameters();
params.encodings[0].maxBitrate = BITRATE; // 720p60: 5 Mbps | 1080p60: 10 Mbps | 1440p60: 18 Mbps
params.encodings[0].maxFramerate = 60;
params.degradationPreference = "maintain-framerate";
await sender.setParameters(params);
```
- Preferir codec **H.264** com `setCodecPreferences` (encode por hardware), com fallback para VP9/VP8.
- Mostrar aviso de upload necessário: bitrate × número de espectadores.

## Restrições
- Precisa de HTTPS (o GitHub Pages já fornece).
- `vite.config.ts` com `base` correto para o Pages e uso de HashRouter.
- Código limpo, comentado em português, README com passo a passo de deploy.
