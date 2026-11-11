// Limite de qualidade e contador de tráfego do mês.

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { CAP_OPTIONS, capHeight, loadCap, onCapChange, saveCap, type QualityCap } from "../core/prefs";
import { formatBytes, getMonthTraffic, onTrafficChange, resetMonthTraffic, type MonthTraffic } from "../core/traffic";

/** Lê o limite atual e acompanha mudanças feitas em qualquer lugar */
export function useCap(): [QualityCap, (cap: QualityCap) => void] {
  const [cap, setCap] = useState(loadCap());
  useEffect(() => onCapChange(setCap), []);
  return [cap, saveCap];
}

/** Limite pessoal. Opções acima do limite do servidor (se houver) ficam desativadas. */
export function CapSelect({ serverCap = "none" }: { serverCap?: QualityCap }) {
  const [cap, setCap] = useCap();
  const maxServer = capHeight(serverCap);
  const effective = capHeight(cap) <= maxServer ? cap : serverCap;
  const current = CAP_OPTIONS.find((o) => o.id === effective);
  return (
    <div className="cap-select">
      <div className="segmented" role="radiogroup" aria-label="Limite de qualidade">
        {CAP_OPTIONS.map((o) => {
          const blocked = capHeight(o.id) > maxServer;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={effective === o.id}
              className={effective === o.id ? "is-active" : ""}
              onClick={() => setCap(o.id)}
              disabled={blocked}
              title={blocked ? "Acima do limite do servidor" : o.hint}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <small className="muted">
        {serverCap !== "none" ? `O servidor limita a ${serverCap}p. ` : `${current?.hint}. `}
        Vale pro que você envia e pro que você recebe.
      </small>
    </div>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function TrafficPanel({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState<MonthTraffic>(getMonthTraffic());
  useEffect(() => onTrafficChange(setT), []);
  const [year, month] = t.month.split("-");

  return (
    <section className={compact ? "traffic" : "panel traffic"}>
      <div className="panel-head">
        <h3>
          <Icon name="upload" size={16} /> Tráfego em {MONTHS[Number(month) - 1]}/{year}
        </h3>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            if (confirm("Zerar o contador deste mês?")) resetMonthTraffic();
          }}
        >
          zerar
        </button>
      </div>
      <p className="upload-value">{formatBytes(t.sent + t.received)}</p>
      <div className="traffic-split">
        <span>
          <b>{formatBytes(t.sent)}</b> enviados
        </span>
        <span>
          <b>{formatBytes(t.received)}</b> recebidos
        </span>
      </div>
      <p className="muted small">Voz e telas, medido neste navegador. Cada aparelho tem o seu contador.</p>
    </section>
  );
}
