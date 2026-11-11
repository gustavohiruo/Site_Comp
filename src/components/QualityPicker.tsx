import { isAllowed, type QualityCap } from "../core/prefs";
import { QUALITIES, type QualityId } from "../core/quality";

interface Props {
  value: QualityId;
  cap: QualityCap;
  onChange: (id: QualityId) => void;
}

export function QualityPicker({ value, cap, onChange }: Props) {
  return (
    <div className="quality" role="radiogroup" aria-label="Qualidade">
      {QUALITIES.map((q) => {
        const allowed = isAllowed(q, cap);
        return (
          <button
            key={q.id}
            role="radio"
            aria-checked={value === q.id}
            className={`quality-opt${value === q.id ? " is-active" : ""}`}
            onClick={() => onChange(q.id)}
            disabled={!allowed}
            title={allowed ? undefined : "Acima do seu limite de qualidade"}
          >
            <span className="quality-label">
              {q.label}
              {q.experimental && <span className="beta">beta</span>}
            </span>
            <span className="quality-hint">{allowed ? q.hint : "Acima do limite"}</span>
          </button>
        );
      })}
    </div>
  );
}
