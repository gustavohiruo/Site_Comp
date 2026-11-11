// Preferências pessoais (ficam só neste navegador).

import { QUALITIES, type QualityId, type QualityPreset } from "./quality";

/** Limite de qualidade: vale pro que você ENVIA e pro que você RECEBE */
export type QualityCap = "none" | "1440" | "1080" | "720";

export const CAP_OPTIONS: { id: QualityCap; label: string; hint: string }[] = [
  { id: "none", label: "Sem limite", hint: "Inclui os modos beta de 120/240 fps" },
  { id: "1440", label: "Até 1440p", hint: "Até 60 fps" },
  { id: "1080", label: "Até 1080p", hint: "Bom equilíbrio de dados" },
  { id: "720", label: "Até 720p", hint: "Economiza internet e franquia" },
];

const CAP_KEY = "telinha:limite";
const listeners = new Set<(cap: QualityCap) => void>();

export function loadCap(): QualityCap {
  try {
    const v = localStorage.getItem(CAP_KEY) as QualityCap | null;
    return v && CAP_OPTIONS.some((o) => o.id === v) ? v : "none";
  } catch {
    return "none";
  }
}

export function saveCap(cap: QualityCap) {
  try {
    localStorage.setItem(CAP_KEY, cap);
  } catch {
    /* sem storage */
  }
  listeners.forEach((fn) => fn(cap));
}

export function onCapChange(fn: (cap: QualityCap) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Altura máxima em pixels (Infinity = sem limite) */
export function capHeight(cap: QualityCap): number {
  return cap === "none" ? Infinity : Number(cap);
}

/** O limite mais rígido entre dois (ex.: o seu e o do servidor) */
export function stricterCap(a: QualityCap, b: QualityCap): QualityCap {
  return capHeight(a) <= capHeight(b) ? a : b;
}

/** Converte o MAX_QUALITY do servidor (720/1080/1440) em limite */
export function capFromServer(maxQuality: number | undefined): QualityCap {
  if (maxQuality === 720 || maxQuality === 1080 || maxQuality === 1440) return String(maxQuality) as QualityCap;
  return "none";
}

/**
 * Presets permitidos pelo limite. O modo Texto/Código é sempre permitido:
 * ele se ajusta ao limite (ver fitPreset) em vez de sumir.
 */
export function isAllowed(p: QualityPreset, cap: QualityCap): boolean {
  if (cap === "none" || p.contentHint === "detail") return true;
  return p.height <= capHeight(cap) && p.frameRate <= 60;
}

/** Reduz a resolução (e o bitrate, na mesma proporção) de um preset pra caber no limite */
export function fitPreset(p: QualityPreset, cap: QualityCap): QualityPreset {
  const max = capHeight(cap);
  if (p.height <= max) return p;
  const scale = max / p.height;
  return {
    ...p,
    width: Math.round(p.width * scale),
    height: max,
    bitrate: Math.round(p.bitrate * scale * scale),
  };
}

/** Se a qualidade escolhida passa do limite, cai para a melhor permitida */
export function clampQuality(id: QualityId, cap: QualityCap): QualityId {
  const current = QUALITIES.find((q) => q.id === id);
  if (current && isAllowed(current, cap)) return id;
  const allowed = QUALITIES.filter((q) => isAllowed(q, cap) && q.contentHint === "motion");
  return allowed.sort((a, b) => b.height - a.height)[0]?.id ?? "720p60";
}
