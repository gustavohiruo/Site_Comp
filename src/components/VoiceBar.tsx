// Controles de voz: microfone e "ensurdecer" (silenciar todo mundo).

import { Icon } from "./Icon";
import type { MicState } from "../core/roomSession";
import type { VoiceActions } from "../hooks/useRoom";

interface Props {
  mic: MicState;
  muted: boolean;
  deafened: boolean;
  voice: VoiceActions;
}

export function VoiceBar({ mic, muted, deafened, voice }: Props) {
  const micOff = mic !== "on" || muted;

  let micLabel = muted ? "Ativar microfone" : "Silenciar microfone";
  if (mic === "pending") micLabel = "Pedindo microfone…";
  if (mic === "unavailable") micLabel = "Liberar microfone";

  return (
    <div className="voice-bar" role="group" aria-label="Voz">
      <button
        className={`voice-btn${micOff ? " is-off" : ""}`}
        onClick={mic === "unavailable" ? voice.retryMic : voice.toggleMute}
        disabled={mic === "pending"}
        title={micLabel}
        aria-label={micLabel}
        aria-pressed={!micOff}
      >
        <Icon name={micOff ? "micOff" : "mic"} />
      </button>
      <button
        className={`voice-btn${deafened ? " is-off" : ""}`}
        onClick={voice.toggleDeafen}
        title={deafened ? "Voltar a ouvir" : "Silenciar todo mundo"}
        aria-label={deafened ? "Voltar a ouvir" : "Silenciar todo mundo"}
        aria-pressed={deafened}
      >
        <Icon name={deafened ? "headphonesOff" : "headphones"} />
      </button>
      {mic === "unavailable" && <span className="muted small">Sem microfone, só ouvindo</span>}
    </div>
  );
}
