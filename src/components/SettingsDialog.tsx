// Endereço do servidor (PC parado). Salvo só neste navegador/app.

import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { CapSelect, TrafficPanel } from "./Prefs";
import { defaultServerUrl, getServerConfig, loadServerOverride, saveServerOverride } from "../core/config";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(loadServerOverride());
  const [check, setCheck] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const fallback = defaultServerUrl();

  function submit(e: FormEvent) {
    e.preventDefault();
    saveServerOverride(url.trim());
    onClose();
  }

  /** Testa se o servidor de tokens responde */
  async function test() {
    saveServerOverride(url.trim());
    const cfg = getServerConfig();
    if (!cfg) return setCheck("fail");
    setCheck("testing");
    try {
      const res = await fetch(cfg.tokenUrl.replace(/token$/, "health"));
      setCheck(res.ok ? "ok" : "fail");
    } catch {
      setCheck("fail");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-head">
          <h2 id="settings-title">Configurações</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">
          A voz e as telas passam pelo servidor que roda no PC parado. Normalmente o endereço já vem configurado; só
          mexa aqui se ele mudou.
        </p>

        <label className="field">
          <span>Endereço do servidor</span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setCheck("idle");
            }}
            placeholder={fallback || "telinha.duckdns.org"}
            spellCheck={false}
            autoCapitalize="off"
          />
          <small className="muted">
            {fallback ? `Em branco = padrão (${fallback}).` : "Ex.: telinha.duckdns.org"}
          </small>
        </label>

        {check !== "idle" && (
          <p className={`small ${check === "ok" ? "tone-ok" : check === "fail" ? "error-text" : "muted"}`}>
            {check === "testing" && "Testando…"}
            {check === "ok" && "Servidor respondeu. Tudo certo!"}
            {check === "fail" && "Sem resposta. Confere o endereço, se o PC parado está ligado e as portas do roteador."}
          </p>
        )}

        <div className="field">
          <span>Limite de qualidade</span>
          <CapSelect />
        </div>

        <TrafficPanel compact />

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={test}>
            Testar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
