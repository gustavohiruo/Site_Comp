// A sala: voz para todos, várias telas ao mesmo tempo, cada um escolhe qual assistir.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CapSelect, TrafficPanel } from "../components/Prefs";
import { QualityPicker } from "../components/QualityPicker";
import { InvitePanel, PeopleList, RoomHeader, SharePicker, StatusCard } from "../components/RoomParts";
import { Stage } from "../components/Stage";
import { VoiceBar } from "../components/VoiceBar";
import { useRoom } from "../hooks/useRoom";
import { fitPreset } from "../core/prefs";
import { getPreset, lowLayer } from "../core/quality";
import type { ReceiveQuality, RoomStatus } from "../core/roomSession";
import { clearCreator } from "../core/storage";
import { formatBitrate } from "../core/webrtc";

interface Props {
  code: string;
  name: string;
  initialPassword: string;
  create: boolean;
}

const RECEIVE_OPTIONS: { id: ReceiveQuality; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "low", label: "Leve" },
];

export default function RoomView({ code, name, initialPassword, create }: Props) {
  const navigate = useNavigate();
  const [password, setPassword] = useState(initialPassword);
  const [attempt, setAttempt] = useState(0);
  const room = useRoom(code, name, password, create, attempt);

  const canShare = !!navigator.mediaDevices?.getDisplayMedia;
  const inRoom = room.status === "connected" || room.status === "reconnecting";
  const preset = fitPreset(getPreset(room.quality), room.cap);
  const myUpload = preset.bitrate + lowLayer(preset).bitrate;
  const watchingOther = !!room.stage && !room.stage.isMe;

  function leave() {
    clearCreator(code);
    navigate("/");
  }

  if (!inRoom) {
    return (
      <div className="page room">
        <RoomHeader code={code} locked={!!password} onLeave={leave} />
        <main className="center">
          <JoinStatus
            status={room.status}
            error={room.error}
            onRetry={() => setAttempt((n) => n + 1)}
            onLeave={leave}
            onPassword={(p) => {
              setPassword(p);
              setAttempt((n) => n + 1);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page room">
      <RoomHeader code={code} locked={!!password} onLeave={leave} />

      {room.status === "reconnecting" && <p className="banner">Conexão instável, reconectando…</p>}
      {room.voice && room.audioBlocked && (
        <button className="banner banner-action" onClick={room.startAudio}>
          <Icon name="volume" size={16} /> O navegador bloqueou o som. Clique aqui pra ouvir a galera.
        </button>
      )}

      <main className="room-layout">
        <div className="room-main">
          <SharePicker shares={room.shares} watching={room.watching} onWatch={room.watch} />

          <Stage media={room.stage} stats={room.stats}>
            <StatusCard icon="screen" title="Ninguém compartilhando a tela">
              <p className="muted">
                {room.voice ? "Vocês já podem conversar. " : ""}Qualquer um pode compartilhar, e se mais de uma pessoa
                compartilhar, cada um escolhe qual assistir.
              </p>
              {canShare && (
                <button className="btn primary large" onClick={room.startShare}>
                  <Icon name="screen" /> Compartilhar minha tela
                </button>
              )}
              {canShare && <ShareTip />}
            </StatusCard>
          </Stage>

          <div className="controls">
            {room.sharing ? (
              <button className="btn danger" onClick={room.stopShare}>
                <Icon name="stop" size={16} /> Parar de compartilhar
              </button>
            ) : (
              <button className="btn primary" onClick={room.startShare} disabled={!canShare}>
                <Icon name="screen" size={16} /> Compartilhar tela
              </button>
            )}

            {watchingOther && (
              <div className="segmented" role="radiogroup" aria-label="Qualidade recebida">
                {RECEIVE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={room.receiveQuality === o.id}
                    className={room.receiveQuality === o.id ? "is-active" : ""}
                    onClick={() => room.setReceiveQuality(o.id)}
                    title="Qual versão da tela você recebe"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {room.voice && (
              <VoiceBar mic={room.mic} muted={room.muted} deafened={room.deafened} voice={room.voiceActions} />
            )}
          </div>

          {canShare && !room.sharing && room.stage && <ShareTip />}

          {room.shareError && <p className="alert">{room.shareError}</p>}

          <section className="panel">
            <div className="panel-head">
              <h3>Qualidade da sua tela</h3>
              <span className="muted small">
                {room.sharing ? "trocar pisca ~1s pra quem assiste" : "vale quando você compartilhar"}
              </span>
            </div>
            <QualityPicker value={room.quality} cap={room.cap} onChange={room.setQuality} />
            <CapSelect serverCap={room.serverCap} />
          </section>
        </div>

        <aside className="sidebar">
          <InvitePanel code={code} hasPassword={!!password} />
          <PeopleList
            people={room.people}
            max={room.maxParticipants}
            voice={room.voice}
            volumes={room.volumes}
            onVolume={room.voiceActions.setVolume}
          />
          <section className="panel upload">
            <div className="panel-head">
              <h3>
                <Icon name="upload" size={16} /> Seu upload ao compartilhar
              </h3>
            </div>
            <p className="upload-value">{formatBitrate(myUpload)}</p>
            <p className="muted small">
              Você envia 2 versões da tela ({preset.height}p e {lowLayer(preset).height}p) uma única vez pro servidor,
              não importa quantos assistam. O servidor manda pra cada um a versão que a internet dele aguenta.
            </p>
          </section>
          <TrafficPanel />
        </aside>
      </main>
    </div>
  );
}

/** Dica pra transmitir com som */
function ShareTip() {
  return (
    <p className="share-tip">
      <Icon name="volume" size={14} /> Pra transmitir jogo com som, escolha <b>Tela inteira</b> e marque{" "}
      <b>Compartilhar áudio do sistema</b>.
    </p>
  );
}

// ---------- Estados antes de entrar ----------

interface JoinProps {
  status: RoomStatus;
  error: string;
  onRetry: () => void;
  onLeave: () => void;
  onPassword: (p: string) => void;
}

function JoinStatus({ status, error, onRetry, onLeave, onPassword }: JoinProps) {
  switch (status) {
    case "connecting":
      return (
        <StatusCard spinner title="Entrando na sala…">
          <p className="muted">Conectando no servidor.</p>
        </StatusCard>
      );
    case "need-password":
    case "wrong-password":
      return <PasswordForm wrong={status === "wrong-password"} onSubmit={onPassword} />;
    case "full":
      return (
        <StatusCard icon="users" title="Sala lotada">
          <p className="muted">Não cabe mais ninguém. Espera alguém sair e tenta de novo.</p>
          <Actions onRetry={onRetry} onLeave={onLeave} />
        </StatusCard>
      );
    case "not-found":
      return (
        <StatusCard icon="close" title="Sala não encontrada">
          <p className="muted">Confere o código. Salas vazias somem depois de alguns minutos.</p>
          <Actions onRetry={onRetry} onLeave={onLeave} />
        </StatusCard>
      );
    case "disconnected":
      return (
        <StatusCard icon="leave" title="Você saiu da sala">
          <p className="muted">A conexão caiu ou o servidor reiniciou.</p>
          <Actions onRetry={onRetry} onLeave={onLeave} />
        </StatusCard>
      );
    default:
      return (
        <StatusCard icon="close" tone="error" title="Algo deu errado">
          <p className="muted">{error}</p>
          <Actions onRetry={onRetry} onLeave={onLeave} />
        </StatusCard>
      );
  }
}

function Actions({ onRetry, onLeave }: { onRetry: () => void; onLeave: () => void }) {
  return (
    <div className="actions">
      <button className="btn primary" onClick={onRetry}>
        <Icon name="refresh" size={16} /> Tentar de novo
      </button>
      <button className="btn ghost" onClick={onLeave}>
        Voltar
      </button>
    </div>
  );
}

function PasswordForm({ wrong, onSubmit }: { wrong: boolean; onSubmit: (p: string) => void }) {
  const [value, setValue] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value) onSubmit(value);
  }
  return (
    <form className="status-card" onSubmit={submit}>
      <span className="status-icon">
        <Icon name="lock" size={22} />
      </span>
      <h2>{wrong ? "Senha incorreta" : "Essa sala tem senha"}</h2>
      <p className="muted">{wrong ? "Confere com quem criou a sala." : "Pede pra quem criou a sala e digita aqui."}</p>
      <div className="invite">
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-label="Senha" />
        <button className="btn primary small" type="submit">
          Entrar
        </button>
      </div>
    </form>
  );
}
