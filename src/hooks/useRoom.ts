// Hook React que embrulha a sessão de sala (LiveKit).

import { useEffect, useRef, useState } from "react";
import { RoomSession, initialRoomSnapshot, type ReceiveQuality, type RoomSnapshot } from "../core/roomSession";
import type { QualityId } from "../core/quality";

/** Ações de voz usadas pela VoiceBar e pela lista de pessoas */
export interface VoiceActions {
  toggleMute: () => void;
  toggleDeafen: () => void;
  retryMic: () => void;
  setVolume: (personId: string, volume: number) => void;
}

/** `attempt` muda para forçar uma nova tentativa de conexão. */
export function useRoom(code: string, name: string, password: string, create: boolean, attempt: number) {
  const [snap, setSnap] = useState<RoomSnapshot>(initialRoomSnapshot);
  const ref = useRef<RoomSession | null>(null);

  useEffect(() => {
    setSnap(initialRoomSnapshot);
    const session = new RoomSession(code, name, password, create, setSnap);
    ref.current = session;
    return () => session.destroy();
  }, [code, name, password, create, attempt]);

  const voiceActions: VoiceActions = {
    toggleMute: () => void ref.current?.toggleMute(),
    toggleDeafen: () => ref.current?.toggleDeafen(),
    retryMic: () => void ref.current?.initMic(),
    setVolume: (id, v) => ref.current?.setVolume(id, v),
  };

  return {
    ...snap,
    voiceActions,
    startShare: () => void ref.current?.startShare(),
    stopShare: () => void ref.current?.stopShare(),
    setQuality: (id: QualityId) => void ref.current?.setQuality(id),
    watch: (id: string) => ref.current?.watch(id),
    setReceiveQuality: (q: ReceiveQuality) => ref.current?.setReceiveQuality(q),
    startAudio: () => void ref.current?.startAudio(),
  };
}
