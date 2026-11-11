// Contador de tráfego do mês (voz + telas), medido neste navegador.
//
// Registra toda RTCPeerConnection criada pela página e, a cada poucos
// segundos, soma os bytes enviados/recebidos desde a última leitura.
// O total fica no localStorage, separado por mês (ex.: "2026-11").

const PREFIX = "telinha:trafego:";
const SAMPLE_MS = 5000;

export interface MonthTraffic {
  month: string;
  sent: number;
  received: number;
}

const pcs = new Set<RTCPeerConnection>();
const last = new WeakMap<RTCPeerConnection, { sent: number; received: number }>();
const listeners = new Set<(t: MonthTraffic) => void>();
let installed = false;

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthTraffic(): MonthTraffic {
  const month = monthKey();
  try {
    const raw = localStorage.getItem(PREFIX + month);
    if (raw) return { month, ...(JSON.parse(raw) as { sent: number; received: number }) };
  } catch {
    /* sem storage */
  }
  return { month, sent: 0, received: 0 };
}

function save(t: MonthTraffic) {
  try {
    localStorage.setItem(PREFIX + t.month, JSON.stringify({ sent: t.sent, received: t.received }));
    // Guarda só o mês atual e o anterior
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && k < PREFIX + previousMonth()) localStorage.removeItem(k);
    }
  } catch {
    /* sem storage */
  }
  listeners.forEach((fn) => fn(t));
}

function previousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

export function resetMonthTraffic() {
  save({ month: monthKey(), sent: 0, received: 0 });
}

export function onTrafficChange(fn: (t: MonthTraffic) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Bytes totais de uma conexão (transporte; no Firefox, o par de candidatos ativo) */
async function totals(pc: RTCPeerConnection): Promise<{ sent: number; received: number }> {
  const report = await pc.getStats();
  let sent = 0;
  let received = 0;
  let hasTransport = false;
  report.forEach((r) => {
    if (r.type === "transport") {
      hasTransport = true;
      sent += r.bytesSent ?? 0;
      received += r.bytesReceived ?? 0;
    }
  });
  if (!hasTransport) {
    report.forEach((r) => {
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
        sent += r.bytesSent ?? 0;
        received += r.bytesReceived ?? 0;
      }
    });
  }
  return { sent, received };
}

async function sample() {
  let dSent = 0;
  let dReceived = 0;
  for (const pc of [...pcs]) {
    if (pc.connectionState === "closed") {
      pcs.delete(pc);
      continue;
    }
    try {
      const now = await totals(pc);
      const prev = last.get(pc) ?? { sent: 0, received: 0 };
      dSent += Math.max(0, now.sent - prev.sent);
      dReceived += Math.max(0, now.received - prev.received);
      last.set(pc, now);
    } catch {
      /* fechando */
    }
  }
  if (dSent || dReceived) {
    const t = getMonthTraffic();
    save({ ...t, sent: t.sent + dSent, received: t.received + dReceived });
  }
}

/** Chamar uma vez, antes de qualquer conexão ser criada (em main.tsx). */
export function installTrafficMeter() {
  if (installed || typeof window.RTCPeerConnection !== "function") return;
  installed = true;
  const Original = window.RTCPeerConnection;
  class TrackedPeerConnection extends Original {
    constructor(config?: RTCConfiguration) {
      super(config);
      pcs.add(this);
    }
  }
  window.RTCPeerConnection = TrackedPeerConnection;
  window.setInterval(() => void sample(), SAMPLE_MS);
  // Pega o finalzinho antes de fechar a aba
  window.addEventListener("pagehide", () => void sample());
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} kB`;
}
