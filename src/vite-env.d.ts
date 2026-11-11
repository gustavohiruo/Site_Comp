/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço do site publicado, usado nos convites gerados pelo app desktop */
  readonly VITE_PUBLIC_URL?: string;
  /** Endereço público do servidor (PC parado), ex.: https://telinha.duckdns.org */
  readonly VITE_SERVER_URL?: string;
  /** Só para teste local: URL direta do LiveKit (ex.: ws://localhost:7880) */
  readonly VITE_LIVEKIT_URL?: string;
  /** Só para teste local: URL direta do servidor de tokens */
  readonly VITE_TOKEN_URL?: string;
}
