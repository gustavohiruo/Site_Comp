// Estatísticas de vídeo (FPS, bitrate, resolução, codec) a partir do getStats.

export interface VideoStats {
  fps: number;
  bitrate: number;
  width?: number;
  height?: number;
  codec?: string;
  /** Motivo de queda de qualidade no envio: "cpu" | "bandwidth" | "none" */
  limitation?: string;
  /** Quantas versões (simulcast) estão sendo enviadas agora */
  layers?: number;
}

export interface StatsSnapshot {
  bytes: number;
  ts: number;
}

/**
 * Lê o vídeo de um relatório de getStats. Com simulcast há várias
 * entradas outbound-rtp (uma por versão): somamos o bitrate e pegamos a maior.
 */
export function readVideoStats(
  report: RTCStatsReport,
  direction: "outbound" | "inbound",
  prev?: StatsSnapshot,
): { stats: VideoStats; snapshot: StatsSnapshot } | null {
  let bytes = 0;
  let ts = 0;
  let found = false;
  let layers = 0;
  const stats: VideoStats = { fps: 0, bitrate: 0 };

  report.forEach((r) => {
    if (r.type !== `${direction}-rtp` || (r.kind ?? r.mediaType) !== "video") return;
    found = true;
    bytes += (direction === "outbound" ? r.bytesSent : r.bytesReceived) ?? 0;
    ts = Math.max(ts, r.timestamp);
    // No envio, camadas pausadas pelo servidor (ninguém precisando) não contam
    if (direction === "inbound" || r.active !== false) layers++;
    if ((r.frameHeight ?? 0) >= (stats.height ?? 0)) {
      stats.fps = Math.round(r.framesPerSecond ?? stats.fps);
      stats.width = r.frameWidth;
      stats.height = r.frameHeight;
      stats.limitation = r.qualityLimitationReason;
      stats.codec = r.codecId ? report.get(r.codecId)?.mimeType?.split("/")[1] : stats.codec;
    }
  });

  if (!found) return null;
  const seconds = prev ? (ts - prev.ts) / 1000 : 0;
  stats.bitrate = prev && seconds > 0 ? Math.max(0, ((bytes - prev.bytes) * 8) / seconds) : 0;
  stats.layers = layers;
  return { stats, snapshot: { bytes, ts } };
}

export function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(bps >= 10_000_000 ? 0 : 1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}
