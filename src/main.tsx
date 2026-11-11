import { createRoot } from "react-dom/client";
import App from "./App";
import { installTrafficMeter } from "./core/traffic";
import "./styles.css";

// Antes de qualquer conexão: começa a contar o tráfego do mês
installTrafficMeter();

// Sem <StrictMode> de propósito: em dev ele monta tudo duas vezes, e cada
// montagem abriria (e fecharia) uma conexão com o servidor.
createRoot(document.getElementById("root")!).render(<App />);
