// Pequenos utilitários de armazenamento local e códigos de sala.

const NAME_KEY = "telinha:nome";
const creatorKey = (code: string) => `telinha:criador:${code}`;

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* sem storage, sem problema */
  }
}

// Quem cria a sala fica marcado nesta aba (sessionStorage). Se recarregar a
// página, o app tenta criar de novo e, como a sala já existe, só entra nela.

export function markCreator(code: string, password: string) {
  try {
    sessionStorage.setItem(creatorKey(code), JSON.stringify({ password }));
  } catch {
    /* ignore */
  }
}

export function getCreatorIntent(code: string): { password: string } | null {
  try {
    const raw = sessionStorage.getItem(creatorKey(code));
    return raw ? (JSON.parse(raw) as { password: string }) : null;
  } catch {
    return null;
  }
}

export function clearCreator(code: string) {
  try {
    sessionStorage.removeItem(creatorKey(code));
  } catch {
    /* ignore */
  }
}

// Alfabeto sem caracteres ambíguos (0/o, 1/l/i)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Gera um código tipo "k7m-p2x" — fácil de ditar no Discord */
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`;
}

/** Aceita o código puro ou o link inteiro colado */
export function normalizeCode(input: string): string {
  let value = input.trim().toLowerCase();
  const match = value.match(/sala\/([^/?#\s]+)/);
  if (match) value = decodeURIComponent(match[1]);
  return value.replace(/[^a-z0-9-]/g, "").slice(0, 32);
}
