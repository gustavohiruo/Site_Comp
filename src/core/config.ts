// Onde fica o servidor (LiveKit + tokens) que roda no PC parado.
//
// Padrão: definido no build pelo arquivo .env
//   VITE_SERVER_URL=https://telinha.duckdns.org
// Dá pra trocar pela tela "Servidor" (fica salvo só neste navegador/app).
//
// A partir do endereço público derivamos:
//   - LiveKit:  wss://telinha.duckdns.org
//   - Tokens:   https://telinha.duckdns.org/api/token

const SERVER_KEY = "telinha:servidor";

export interface ServerConfig {
  livekitUrl: string;
  tokenUrl: string;
}

export function loadServerOverride(): string {
  try {
    return localStorage.getItem(SERVER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveServerOverride(url: string) {
  try {
    if (url) localStorage.setItem(SERVER_KEY, url);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    /* sem storage */
  }
}

export function defaultServerUrl(): string {
  return import.meta.env.VITE_SERVER_URL ?? "";
}

export function getServerConfig(): ServerConfig | null {
  // Teste local: LiveKit e tokens em portas separadas, sem proxy
  const envLivekit = import.meta.env.VITE_LIVEKIT_URL;
  const envToken = import.meta.env.VITE_TOKEN_URL;
  const override = loadServerOverride();
  if (!override && envLivekit && envToken) return { livekitUrl: envLivekit, tokenUrl: envToken };

  const base = (override || defaultServerUrl()).trim().replace(/\/+$/, "");
  if (!base) return null;
  const url = /^https?:\/\//.test(base) ? base : `https://${base}`;
  return {
    livekitUrl: url.replace(/^http/, "ws"),
    tokenUrl: `${url}/api/token`,
  };
}
