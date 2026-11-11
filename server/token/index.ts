// Servidor de tokens do Telinha.
//
// O LiveKit só aceita quem tem um token assinado com a chave secreta. Essa chave
// fica SÓ aqui no servidor — nunca no app nem no site. Este serviço:
//   - cria salas (com senha opcional)
//   - confere a senha de quem quer entrar
//   - devolve um token de acesso válido por algumas horas
//
// Roda direto no Node 24 (que entende TypeScript), sem etapa de build.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.LIVEKIT_API_KEY ?? "devkey";
const API_SECRET = process.env.LIVEKIT_API_SECRET ?? "secret";
/** Endereço interno do LiveKit (dentro do Docker / da máquina) */
const LIVEKIT_HOST = process.env.LIVEKIT_HOST ?? "http://localhost:7880";
const MAX_PARTICIPANTS = Number(process.env.MAX_PARTICIPANTS ?? 6);

/** Qualidade máxima de tela na sala (altura em pixels): 720, 1080 ou 1440 */
const MAX_QUALITY = [720, 1080, 1440].includes(Number(process.env.MAX_QUALITY))
  ? Number(process.env.MAX_QUALITY)
  : 1080;

/**
 * Chat de voz ligado? Desligado = ninguém pode publicar microfone (o token só
 * permite tela e som da tela) e o site esconde tudo de voz. Pra religar:
 * VOICE_ENABLED=true no .env e reiniciar o servidor de tokens.
 */
const VOICE_ENABLED = /^(1|true|sim|yes)$/i.test(process.env.VOICE_ENABLED ?? "false");

const svc = new RoomServiceClient(LIVEKIT_HOST, API_KEY, API_SECRET);

interface RoomInfo {
  salt: Buffer;
  hash: Buffer | null; // null = sala sem senha
  createdAt: number;
}

/** Salas criadas por este servidor. Guardado só em memória (some ao reiniciar). */
const rooms = new Map<string, RoomInfo>();

const hashPassword = (password: string, salt: Buffer) => scryptSync(password, salt, 32);

function checkPassword(info: RoomInfo, password: string): boolean {
  if (!info.hash) return true;
  const attempt = hashPassword(password, info.salt);
  return timingSafeEqual(attempt, info.hash);
}

// ---------- Limite simples de tentativas (contra chute de senha) ----------

const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 30; // 30 pedidos por minuto por IP
}

// ---------- HTTP ----------

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    // O site (GitHub Pages) e o app (tauri.localhost) chamam de outra origem
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 4096) throw new Error("corpo grande demais");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const ROOM_RE = /^[a-z0-9-]{3,32}$/;

function cleanName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 24) : "";
  return name || "Anônimo";
}

/** Garante que a sala existe no LiveKit (ele apaga salas vazias depois de um tempo). */
async function ensureLiveKitRoom(room: string) {
  const [existing] = await svc.listRooms([room]);
  if (existing) return existing;
  return svc.createRoom({ name: room, maxParticipants: MAX_PARTICIPANTS, emptyTimeout: 300, departureTimeout: 20 });
}

async function handleToken(req: IncomingMessage, res: ServerResponse) {
  const ip = req.socket.remoteAddress ?? "?";
  if (rateLimited(ip)) return send(res, 429, { error: "devagar" });

  const body = await readJson(req);
  const room = typeof body.room === "string" ? body.room.toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = cleanName(body.name);
  if (!ROOM_RE.test(room)) return send(res, 400, { error: "codigo" });

  let info = rooms.get(room);
  if (body.create === true) {
    if (info) return send(res, 409, { error: "existe" });
    const salt = randomBytes(16);
    info = { salt, hash: password ? hashPassword(password, salt) : null, createdAt: Date.now() };
    rooms.set(room, info);
  } else {
    if (!info) return send(res, 404, { error: "nao-encontrada" });
    if (!checkPassword(info, password)) return send(res, 401, { error: password ? "senha-errada" : "senha" });
  }

  const lkRoom = await ensureLiveKitRoom(room);
  if (lkRoom.numParticipants >= MAX_PARTICIPANTS) return send(res, 409, { error: "cheia" });

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: `${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "p"}-${randomBytes(4).toString("hex")}`,
    name,
    ttl: "8h",
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true, // para avisar "estou surdo"
    // Todo mundo pode compartilhar a tela. Microfone só com a voz ligada.
    canPublishSources: VOICE_ENABLED
      ? [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
  });

  send(res, 200, {
    token: await at.toJwt(),
    maxParticipants: MAX_PARTICIPANTS,
    maxQuality: MAX_QUALITY,
    voice: VOICE_ENABLED,
  });
}

const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && (path === "/health" || path === "/api/health")) return send(res, 200, { ok: true });
  if (req.method === "POST" && (path === "/token" || path === "/api/token")) {
    handleToken(req, res).catch((err) => {
      console.error("[token]", err);
      send(res, 500, { error: "interno" });
    });
    return;
  }
  send(res, 404, { error: "rota" });
});

// Limpeza: esquece salas que não existem mais no LiveKit há mais de 10 minutos
setInterval(async () => {
  try {
    const active = new Set((await svc.listRooms()).map((r) => r.name));
    const cutoff = Date.now() - 10 * 60_000;
    for (const [name, info] of rooms) {
      if (!active.has(name) && info.createdAt < cutoff) rooms.delete(name);
    }
    for (const [ip, h] of hits) if (Date.now() > h.reset) hits.delete(ip);
  } catch (err) {
    console.error("[limpeza]", err);
  }
}, 60_000).unref();

server.listen(PORT, () =>
  console.log(
    `[token] porta ${PORT} | LiveKit ${LIVEKIT_HOST} | até ${MAX_PARTICIPANTS} pessoas | ${MAX_QUALITY}p | voz ${VOICE_ENABLED ? "ligada" : "desligada"}`,
  ),
);
