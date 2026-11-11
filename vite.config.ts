import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O SITE é o build padrão (`npm run dev` / `npm run build`).
// O modo "app" só existe para o app desktop guardado em desktop/ reaproveitar
// a mesma interface: `npm run build:app` gera dist-app/ com caminhos relativos.
export default defineConfig(({ mode }) => {
  const isApp = mode === "app";

  return {
    plugins: [react()],
    // No GitHub Pages o site fica em /<repositorio>/ (o workflow define BASE_PATH)
    base: isApp ? "./" : (process.env.BASE_PATH ?? "/"),
    build: {
      outDir: isApp ? "dist-app" : "dist",
      // O app roda no WebView2 (Chromium atual): dá pra gerar JS mais moderno
      target: isApp ? "chrome120" : "es2021",
    },
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
      // A pasta do app tem a compilação do Rust (arquivos travados durante o build)
      watch: { ignored: ["**/desktop/**", "**/server/**"] },
    },
  };
});
