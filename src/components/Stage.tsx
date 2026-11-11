// O "palco": vídeo com overlay de estatísticas, som e tela cheia.
//
// O vídeo é anexado com track.attach() do LiveKit (e não com srcObject direto):
// é assim que o adaptiveStream sabe o tamanho do vídeo na tela e pede ao
// servidor a versão certa do simulcast, ou pausa o vídeo se ele sumir da vista.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { StageMedia } from "../core/roomSession";
import { formatBitrate, type VideoStats } from "../core/webrtc";

interface Props {
  media: StageMedia | null;
  stats: VideoStats | null;
  children?: ReactNode;
}

const LIMITATION: Record<string, string> = {
  cpu: "limitado pela CPU",
  bandwidth: "limitado pela banda",
};

export function Stage({ media, stats, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // A própria tela fica sempre muda na prévia (senão dá eco)
  const alwaysMuted = !media || media.isMe;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !media) return;
    media.video.attach(el);
    media.audio?.attach(el);
    el.muted = alwaysMuted || muted;
    return () => {
      media.video.detach(el);
      media.audio?.detach(el);
    };
    // muted é tratado no efeito abaixo; aqui só reanexamos quando a mídia muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.key]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = alwaysMuted || muted;
  }, [alwaysMuted, muted, media?.key]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (wrapRef.current?.requestFullscreen) {
      wrapRef.current.requestFullscreen().catch(() => {});
    } else {
      // iPhone: só o próprio <video> entra em tela cheia
      (videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current && !next) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
  }

  const hasAudio = !alwaysMuted && !!media?.audio;

  return (
    <div ref={wrapRef} className={`stage${media ? " is-live" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted onDoubleClick={toggleFullscreen} />

      {!media && <div className="stage-empty">{children}</div>}

      {media && (
        <div className="stage-overlay">
          <div className="stage-top">
            <span className="live-pill">
              <span className="live-dot" /> {media.isMe ? "Sua tela" : media.name}
            </span>
            {stats && (
              <div className="stat-chips">
                <span className="chip">
                  <b>{stats.fps}</b> fps
                </span>
                {stats.bitrate > 0 && (
                  <span className="chip">
                    <b>{formatBitrate(stats.bitrate)}</b> {media.isMe ? "upload" : ""}
                  </span>
                )}
                {stats.height ? <span className="chip">{stats.height}p</span> : null}
                {stats.codec && <span className="chip">{stats.codec}</span>}
                {media.isMe && stats.layers ? (
                  <span className="chip">{stats.layers === 1 ? "1 versão" : `${stats.layers} versões`}</span>
                ) : null}
                {stats.limitation && LIMITATION[stats.limitation] && (
                  <span className="chip chip-warn">{LIMITATION[stats.limitation]}</span>
                )}
              </div>
            )}
          </div>

          <div className="stage-bottom">
            {hasAudio && (
              <button
                className={`stage-btn${muted ? " is-attention" : ""}`}
                onClick={toggleMute}
                aria-label={muted ? "Ativar som da tela" : "Silenciar som da tela"}
              >
                <Icon name={muted ? "mute" : "volume"} />
                <span>{muted ? "Ativar som" : "Som ligado"}</span>
              </button>
            )}
            <button className="stage-btn" onClick={toggleFullscreen} aria-label="Tela cheia">
              <Icon name={fullscreen ? "shrink" : "expand"} />
              <span>{fullscreen ? "Sair" : "Tela cheia"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
