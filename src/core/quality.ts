// Presets de qualidade do compartilhamento.

export type QualityId = "720p60" | "1080p60" | "1440p60" | "texto" | "1440p120" | "1440p240";

export interface QualityPreset {
  id: QualityId;
  label: string;
  hint: string;
  /** Pode não funcionar em todo PC/navegador */
  experimental?: boolean;
  width: number;
  height: number;
  frameRate: number;
  /** Bitrate máximo por espectador, em bits por segundo */
  bitrate: number;
  /** "motion" prioriza fluidez; "detail" prioriza nitidez (texto/código) */
  contentHint: "motion" | "detail";
  /** O que o encoder sacrifica quando a banda aperta */
  degradation: "maintain-framerate" | "maintain-resolution";
}

export const QUALITIES: QualityPreset[] = [
  {
    id: "720p60",
    label: "720p · 60",
    hint: "Leve, pra internet modesta",
    width: 1280,
    height: 720,
    frameRate: 60,
    bitrate: 6_000_000,
    contentHint: "motion",
    degradation: "maintain-framerate",
  },
  {
    id: "1080p60",
    label: "1080p · 60",
    hint: "O equilíbrio ideal",
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 15_000_000,
    contentHint: "motion",
    degradation: "maintain-framerate",
  },
  {
    id: "1440p60",
    label: "1440p · 60",
    hint: "No talo, pede upload forte",
    width: 2560,
    height: 1440,
    frameRate: 60,
    bitrate: 28_000_000,
    contentHint: "motion",
    degradation: "maintain-framerate",
  },
  {
    id: "texto",
    label: "Texto / Código",
    hint: "Nitidez acima de tudo, 30 fps",
    width: 2560,
    height: 1440,
    frameRate: 30,
    bitrate: 12_000_000,
    contentHint: "detail",
    // Para texto, vale mais manter a resolução do que os quadros
    degradation: "maintain-resolution",
  },
  {
    id: "1440p120",
    label: "1440p · 120",
    hint: "Experimental: precisa de monitor 120 Hz+",
    experimental: true,
    width: 2560,
    height: 1440,
    frameRate: 120,
    bitrate: 40_000_000,
    contentHint: "motion",
    degradation: "maintain-framerate",
  },
  {
    id: "1440p240",
    label: "1440p · 240",
    hint: "Experimental: testa o limite do seu PC",
    experimental: true,
    width: 2560,
    height: 1440,
    frameRate: 240,
    bitrate: 60_000_000,
    contentHint: "motion",
    degradation: "maintain-framerate",
  },
];

export const DEFAULT_QUALITY: QualityId = "1080p60";

/**
 * Versão leve do simulcast (a 2ª das 2 versões), para quem tem internet fraca
 * ou está com o vídeo pequeno na tela. Fica ~1/4 dos pixels da versão cheia.
 */
export function lowLayer(p: QualityPreset): { width: number; height: number; bitrate: number; frameRate: number } {
  if (p.contentHint === "detail") return { width: 1280, height: 720, bitrate: 1_500_000, frameRate: 15 };
  if (p.height <= 720) return { width: 640, height: 360, bitrate: 1_000_000, frameRate: 30 };
  return { width: 1280, height: 720, bitrate: 2_500_000, frameRate: 30 };
}

export function getPreset(id: QualityId): QualityPreset {
  return QUALITIES.find((q) => q.id === id) ?? QUALITIES[1];
}
