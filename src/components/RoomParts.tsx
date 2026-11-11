// Peças compartilhadas pelas telas de sala: cabeçalho, pessoas, convite e avisos.

import { useState, type ReactNode } from "react";
import { Brand } from "./Brand";
import { Icon, type IconName } from "./Icon";
import type { PersonState, ShareInfo } from "../core/roomSession";
import { roomLink } from "../core/platform";

/** "Telas ao vivo": escolhe qual compartilhamento assistir */
export function SharePicker({
  shares,
  watching,
  onWatch,
}: {
  shares: ShareInfo[];
  watching: string | null;
  onWatch: (id: string) => void;
}) {
  if (shares.length === 0) return null;
  return (
    <div className="share-picker" role="tablist" aria-label="Telas ao vivo">
      <span className="share-picker-label">
        <span className="live-dot" /> Telas ao vivo
      </span>
      {shares.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={watching === s.id}
          className={`share-chip${watching === s.id ? " is-active" : ""}`}
          onClick={() => onWatch(s.id)}
        >
          <Icon name="screen" size={14} />
          {s.isMe ? "Sua tela" : s.name}
        </button>
      ))}
    </div>
  );
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para contextos sem clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return { copied, copy };
}

export function RoomHeader({ code, locked, onLeave }: { code: string; locked: boolean; onLeave: () => void }) {
  const { copied, copy } = useCopy();
  return (
    <header className="topbar">
      <Brand />
      <button className="room-code" onClick={() => copy(roomLink(code))} title="Copiar link da sala">
        {locked && <Icon name="lock" size={14} />}
        <span className="room-code-label">Sala</span>
        <span className="mono">{code}</span>
        <Icon name={copied ? "check" : "copy"} size={14} />
      </button>
      <button className="btn ghost small" onClick={onLeave}>
        <Icon name="leave" size={16} />
        <span className="hide-sm">Sair</span>
      </button>
    </header>
  );
}

interface PeopleProps {
  people: PersonState[];
  max: number;
  /** Chat de voz ligado? Desligado: sem anel, sem ícones de mic e sem volume */
  voice: boolean;
  volumes?: Record<string, number>;
  onVolume?: (id: string, volume: number) => void;
}

const AVATAR_HUES = [14, 32, 160, 200, 260, 320];

function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function PeopleList({ people, max, voice, volumes = {}, onVolume }: PeopleProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Icon name="users" size={16} /> Na sala
        </h3>
        <span className="muted small">
          {people.length}/{max}
        </span>
      </div>
      <ul className="people">
        {people.map((p) => (
          <li key={p.id} className={voice && p.speaking ? "is-speaking" : undefined}>
            <div className="person-row">
              <span className="avatar" style={{ ["--hue" as string]: hueFor(p.name) }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="person-name">
                {p.name}
                {p.isMe && <span className="muted"> (você)</span>}
              </span>
              {p.poorConnection && <span className="person-detail tone-warn">conexão ruim</span>}
              {p.sharing && (
                <span className="person-flag is-share" title="Compartilhando a tela">
                  <Icon name="screen" size={14} />
                </span>
              )}
              {voice && p.deafened && (
                <span className="person-flag" title="Não está ouvindo ninguém">
                  <Icon name="headphonesOff" size={14} />
                </span>
              )}
              {voice && p.muted && (
                <span className="person-flag" title="Microfone desligado">
                  <Icon name="micOff" size={14} />
                </span>
              )}
            </div>
            {voice && !p.isMe && onVolume && (
              <label className="person-volume">
                <span className="sr-only">Volume de {p.name}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volumes[p.id] ?? 1}
                  onChange={(e) => onVolume(p.id, Number(e.target.value))}
                />
                <span className="person-volume-value">{Math.round((volumes[p.id] ?? 1) * 100)}%</span>
              </label>
            )}
          </li>
        ))}
      </ul>
      {people.length <= 1 && <p className="muted small empty-hint">Ninguém chegou ainda. Manda o link!</p>}
    </section>
  );
}

export function InvitePanel({ code, hasPassword }: { code: string; hasPassword: boolean }) {
  const { copied, copy } = useCopy();
  const link = roomLink(code);
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Chama a galera</h3>
      </div>
      <div className="invite">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link da sala" />
        <button className="btn small" onClick={() => copy(link)}>
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {link === code && (
        <p className="muted small">
          Manda esse código: quem tiver o app entra em “Entrar numa sala”. Pra gerar um link pro site, veja o
          README.
        </p>
      )}
      {hasPassword && (
        <p className="muted small">
          <Icon name="lock" size={12} /> A sala tem senha — manda ela separado.
        </p>
      )}
    </section>
  );
}

/** Bloco centralizado para estados vazios, esperas e erros. */
export function StatusCard({
  icon,
  title,
  children,
  tone = "default",
  spinner,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  tone?: "default" | "error";
  spinner?: boolean;
}) {
  return (
    <div className={`status-card tone-${tone}`}>
      {spinner ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        icon && (
          <span className="status-icon">
            <Icon name={icon} size={22} />
          </span>
        )
      )}
      <h2>{title}</h2>
      {children}
    </div>
  );
}
