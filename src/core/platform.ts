// Tudo que muda entre o SITE e o APP desktop fica concentrado aqui.
// O resto de src/ (núcleo, interface, voz, tela) é igual nos dois.

/** true quando a interface está rodando dentro do app desktop (Tauri, em desktop/) */
export const isDesktopApp = "__TAURI_INTERNALS__" in window;

/**
 * Endereço público do site (GitHub Pages). No app o endereço local não serve
 * pros amigos, então o convite aponta pro site publicado.
 * Configure em .env: VITE_PUBLIC_URL=https://usuario.github.io/telinha/
 */
const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL ?? "";

/** Link de convite da sala */
export function roomLink(code: string): string {
  const base = PUBLIC_URL || (isDesktopApp ? "" : `${location.origin}${location.pathname}`);
  if (!base) return code; // app sem site configurado: compartilha só o código
  return `${base.replace(/\/?$/, "/")}#/sala/${code}`;
}
