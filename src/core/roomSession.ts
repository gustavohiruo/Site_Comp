// Sessão de sala via LiveKit (SFU no PC parado).
//
// Cada pessoa manda sua voz e sua tela UMA vez para o servidor, que distribui.
// Todos são iguais: qualquer um fala, qualquer um compartilha a tela.
//
// Economias:
//  - autoSubscribe desligado: só recebemos o que vamos usar
//  - telas: só baixamos a tela que estamos assistindo
//  - "silenciar todos": deixamos de receber as vozes (economiza banda também)
//  - simulcast com 2 versões + adaptiveStream/dynacast: cada um recebe a versão
//    que a internet e o tamanho do vídeo comportam, e versões que ninguém usa
//    deixam de ser codificadas

import {
  ConnectionQuality,
  type LocalTrack,
  LocalVideoTrack,
  type Participant,
  RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  VideoPreset,
  VideoQuality,
} from "livekit-client";
import { getServerConfig } from "./config";
import {
  capFromServer,
  capHeight,
  clampQuality,
  fitPreset,
  isAllowed,
  loadCap,
  onCapChange,
  stricterCap,
  type QualityCap,
} from "./prefs";
import { DEFAULT_QUALITY, getPreset, lowLayer, type QualityId, type QualityPreset } from "./quality";
import { readVideoStats, type StatsSnapshot, type VideoStats } from "./webrtc";

export type MicState = "pending" | "on" | "unavailable";
/** auto = a versão que a internet e o tamanho do vídeo comportam; low = sempre a leve */
export type ReceiveQuality = "auto" | "low";

export type RoomStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "need-password"
  | "wrong-password"
  | "full"
  | "not-found"
  | "disconnected"
  | "error";

export interface PersonState {
  id: string;
  name: string;
  isMe: boolean;
  muted: boolean;
  speaking: boolean;
  deafened: boolean;
  sharing: boolean;
  poorConnection: boolean;
}

export interface ShareInfo {
  id: string;
  name: string;
  isMe: boolean;
}

/** O que está no "palco" agora */
export interface StageMedia {
  key: string;
  video: Track;
  audio?: Track;
  isMe: boolean;
  name: string;
}

export interface RoomSnapshot {
  status: RoomStatus;
  error: string;
  myId: string;
  maxParticipants: number;
  people: PersonState[];
  shares: ShareInfo[];
  watching: string | null;
  stage: StageMedia | null;
  stats: VideoStats | null;
  mic: MicState;
  muted: boolean;
  deafened: boolean;
  volumes: Record<string, number>;
  sharing: boolean;
  quality: QualityId;
  shareError: string;
  audioBlocked: boolean;
  receiveQuality: ReceiveQuality;
  /** Limite de qualidade efetivo (o mais rígido entre o seu e o do servidor) */
  cap: QualityCap;
  /** Limite definido pelo servidor (MAX_QUALITY no .env) */
  serverCap: QualityCap;
  /** Chat de voz ligado no servidor (VOICE_ENABLED no .env) */
  voice: boolean;
}

export const initialRoomSnapshot: RoomSnapshot = {
  status: "connecting",
  error: "",
  myId: "",
  maxParticipants: 10,
  people: [],
  shares: [],
  watching: null,
  stage: null,
  stats: null,
  mic: "pending",
  muted: false,
  deafened: false,
  volumes: {},
  sharing: false,
  quality: DEFAULT_QUALITY,
  shareError: "",
  audioBlocked: false,
  receiveQuality: "auto",
  cap: "none",
  serverCap: "none",
  voice: false,
};

/** Quanto esperar antes de trocar de tela quando a que você assiste some (ex.: troca de qualidade) */
const SHARE_GRACE_MS = 4000;

export class RoomSession {
  private room: Room;
  private snapshot: RoomSnapshot = initialRoomSnapshot;
  private destroyed = false;
  private muted = false;
  private deafened = false;
  private volumes: Record<string, number> = {};
  private quality: QualityId = DEFAULT_QUALITY;
  private receiveQuality: ReceiveQuality = "auto";
  private watching: string | null = null;
  private graceTimer = 0;
  private screenVideo: LocalVideoTrack | null = null;
  private screenAudio: LocalTrack | null = null;
  private prevStats?: StatsSnapshot;
  private statsKey = "";
  private statsTimer = 0;
  private personalCap: QualityCap = loadCap();
  private serverCap: QualityCap = "none";
  /** Voz desligada até o servidor dizer o contrário: nunca pedimos microfone antes disso */
  private voice = false;
  private offCap: () => void;

  constructor(
    private code: string,
    private name: string,
    private password: string,
    private create: boolean,
    private onChange: (s: RoomSnapshot) => void,
  ) {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      publishDefaults: {
        dtx: true, // silêncio quase não gasta banda
        red: true, // redundância: voz aguenta perda de pacotes
        videoCodec: "h264", // encode por hardware na maioria das placas
        backupCodec: false,
      },
    });
    this.quality = clampQuality(DEFAULT_QUALITY, this.cap);
    this.snapshot = { ...initialRoomSnapshot, cap: this.cap, quality: this.quality };
    this.offCap = onCapChange((cap) => {
      this.personalCap = cap;
      this.applyCap();
    });
    this.bindEvents();
    void this.start();
  }

  /** O limite que vale: o mais rígido entre o seu e o do servidor */
  private get cap(): QualityCap {
    return stricterCap(this.personalCap, this.serverCap);
  }

  /** Limite mudou (aqui, nas configurações ou no servidor): ajusta envio e recebimento */
  private applyCap() {
    const cap = this.cap;
    this.emit({ cap, serverCap: this.serverCap });
    const allowed = clampQuality(this.quality, cap);
    if (allowed !== this.quality) void this.setQuality(allowed);
    else if (this.screenVideo) void this.setQuality(this.quality); // reajusta o modo texto
    this.syncSubscriptions();
  }

  // ---------- Conexão ----------

  private async start() {
    const cfg = getServerConfig();
    if (!cfg) {
      this.emit({
        status: "error",
        error: "Nenhum servidor configurado. Abra “Configurações” na tela inicial e coloque o endereço do servidor.",
      });
      return;
    }

    let token: string;
    try {
      const result = await this.fetchToken(cfg.tokenUrl, this.create);
      if (!result) return;
      token = result;
    } catch (err) {
      console.warn("[telinha] token", err);
      this.emit({ status: "error", error: "Não deu pra falar com o servidor. Ele está ligado? Confere o endereço em “Configurações”." });
      return;
    }

    try {
      await this.room.connect(cfg.livekitUrl, token, { autoSubscribe: false });
    } catch (err) {
      if (this.destroyed) return;
      console.warn("[telinha] connect", err);
      this.emit({
        status: "error",
        error: "O servidor respondeu, mas a conexão de vídeo falhou. Confira as portas UDP no roteador (README).",
      });
      return;
    }
    if (this.destroyed) return void this.room.disconnect();

    this.emit({ status: "connected", myId: this.room.localParticipant.identity, audioBlocked: !this.room.canPlaybackAudio });
    this.syncSubscriptions();
    this.refresh();
    if (this.voice) void this.initMic(); // voz desligada: nunca pede o microfone
    this.statsTimer = window.setInterval(() => void this.collectStats(), 1000);
  }

  /** Pede o token. Se a sala já existe ao "criar" (ex.: F5 de quem criou), entra nela. */
  private async fetchToken(url: string, create: boolean): Promise<string | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: this.code, name: this.name, password: this.password, create }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      token?: string;
      error?: string;
      maxParticipants?: number;
      maxQuality?: number;
      voice?: boolean;
    };
    if (res.ok && body.token) {
      this.voice = body.voice === true;
      this.serverCap = capFromServer(body.maxQuality);
      this.emit({ maxParticipants: body.maxParticipants ?? this.snapshot.maxParticipants, voice: this.voice });
      this.applyCap();
      return body.token;
    }
    if (body.error === "existe" && create) return this.fetchToken(url, false);
    if (res.status === 401) this.emit({ status: body.error === "senha-errada" ? "wrong-password" : "need-password" });
    else if (res.status === 404) this.emit({ status: "not-found" });
    else if (body.error === "cheia") this.emit({ status: "full" });
    else if (res.status === 429) this.emit({ status: "error", error: "Muitas tentativas. Espera um minutinho." });
    else this.emit({ status: "error", error: `O servidor recusou a entrada (${res.status}).` });
    return null;
  }

  private bindEvents() {
    const r = this.room;
    const refresh = () => this.refresh();
    r.on(RoomEvent.ParticipantConnected, () => {
      this.syncSubscriptions();
      refresh();
    });
    r.on(RoomEvent.ParticipantDisconnected, () => {
      this.syncSubscriptions();
      refresh();
    });
    r.on(RoomEvent.TrackPublished, () => {
      this.syncSubscriptions();
      refresh();
    });
    r.on(RoomEvent.TrackUnpublished, () => {
      this.syncSubscriptions();
      refresh();
    });
    r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => this.onSubscribed(track, participant));
    r.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
      refresh();
    });
    r.on(RoomEvent.LocalTrackPublished, refresh);
    r.on(RoomEvent.LocalTrackUnpublished, refresh);
    r.on(RoomEvent.TrackMuted, refresh);
    r.on(RoomEvent.TrackUnmuted, refresh);
    r.on(RoomEvent.ActiveSpeakersChanged, refresh);
    r.on(RoomEvent.ParticipantAttributesChanged, refresh);
    r.on(RoomEvent.ConnectionQualityChanged, refresh);
    r.on(RoomEvent.AudioPlaybackStatusChanged, () => this.emit({ audioBlocked: !r.canPlaybackAudio }));
    r.on(RoomEvent.Reconnecting, () => this.emit({ status: "reconnecting" }));
    r.on(RoomEvent.Reconnected, () => this.emit({ status: "connected" }));
    r.on(RoomEvent.Disconnected, () => {
      if (!this.destroyed) this.emit({ status: "disconnected", stage: null, stats: null });
    });
  }

  private onSubscribed(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.source === Track.Source.Microphone) {
      // Voz: toca num <audio> escondido, com o volume escolhido pra essa pessoa
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      participant.setVolume(this.volumes[participant.identity] ?? 1, Track.Source.Microphone);
    }
    this.refresh();
  }

  /**
   * Decide o que receber: vozes (a não ser que esteja "surdo") e só a tela
   * que está sendo assistida.
   */
  private syncSubscriptions() {
    this.pickWatching();
    for (const p of this.room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        let want = false;
        if (pub.source === Track.Source.Microphone) want = this.voice && !this.deafened;
        else if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
          want = p.identity === this.watching;
        }
        if (pub.isSubscribed !== want) pub.setSubscribed(want);
        if (want && pub.source === Track.Source.ScreenShare) this.applyReceiveQuality(pub);
      }
    }
  }

  /** Escolhe automaticamente uma tela pra assistir, se for preciso */
  private pickWatching() {
    const sharers = this.sharers();
    const current = this.watching;
    if (current && sharers.some((s) => s.id === current)) {
      window.clearTimeout(this.graceTimer);
      this.graceTimer = 0;
      return;
    }
    // A tela assistida sumiu: espera um pouco (pode ser só troca de qualidade)
    if (current && this.room.remoteParticipants.has(current) && !this.graceTimer) {
      this.graceTimer = window.setTimeout(() => {
        this.graceTimer = 0;
        this.watching = null;
        this.syncSubscriptions();
        this.refresh();
      }, SHARE_GRACE_MS);
      return;
    }
    if (this.graceTimer) return;
    // Preferimos a tela de outra pessoa; senão, a própria prévia
    const next = sharers.find((s) => !s.isMe) ?? sharers.find((s) => s.isMe) ?? null;
    this.watching = next?.id ?? null;
  }

  private sharers(): ShareInfo[] {
    const list: ShareInfo[] = [];
    const me = this.room.localParticipant;
    for (const p of [me, ...this.room.remoteParticipants.values()]) {
      if (p.getTrackPublication(Track.Source.ScreenShare)) {
        list.push({ id: p.identity, name: p.name || p.identity, isMe: p === me });
      }
    }
    return list;
  }

  // ---------- Ações: voz ----------

  async initMic() {
    if (!this.voice) return;
    this.emit({ mic: "pending" });
    try {
      // Publica o microfone; se a pessoa já tinha clicado em mudo, publica mudo
      await this.room.localParticipant.setMicrophoneEnabled(true);
      if (this.muted) await this.room.localParticipant.setMicrophoneEnabled(false);
      this.emit({ mic: "on" });
    } catch (err) {
      console.warn("[telinha] microfone", err);
      this.emit({ mic: "unavailable" });
    }
    this.refresh();
  }

  async toggleMute() {
    this.muted = !this.muted;
    this.emit({ muted: this.muted });
    if (this.snapshot.mic === "on") await this.room.localParticipant.setMicrophoneEnabled(!this.muted).catch(() => {});
    this.refresh();
  }

  toggleDeafen() {
    if (!this.voice) return;
    this.deafened = !this.deafened;
    void this.room.localParticipant.setAttributes({ deafened: this.deafened ? "1" : "" }).catch(() => {});
    this.syncSubscriptions();
    this.emit({ deafened: this.deafened });
  }

  setVolume(personId: string, volume: number) {
    this.volumes = { ...this.volumes, [personId]: volume };
    this.room.remoteParticipants.get(personId)?.setVolume(volume, Track.Source.Microphone);
    this.emit({ volumes: this.volumes });
  }

  async startAudio() {
    await this.room.startAudio().catch(() => {});
    this.emit({ audioBlocked: !this.room.canPlaybackAudio });
  }

  // ---------- Ações: telas ----------

  watch(personId: string) {
    this.watching = personId;
    window.clearTimeout(this.graceTimer);
    this.graceTimer = 0;
    this.syncSubscriptions();
    this.refresh();
  }

  setReceiveQuality(q: ReceiveQuality) {
    this.receiveQuality = q;
    this.syncSubscriptions();
    this.emit({ receiveQuality: q });
  }

  private applyReceiveQuality(pub: RemoteTrackPublication) {
    // Acima do limite: sempre a versão leve (720p)
    const tooBig = (pub.dimensions?.height ?? 0) > capHeight(this.cap);
    // "auto" libera a versão cheia; o adaptiveStream e o servidor ainda descem
    // pra leve se a internet ou o tamanho do vídeo na tela não comportarem
    pub.setVideoQuality(tooBig || this.receiveQuality === "low" ? VideoQuality.LOW : VideoQuality.HIGH);
  }

  async startShare() {
    if (this.screenVideo) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.emit({ shareError: "Aqui não dá pra compartilhar tela. Usa o app ou o Chrome/Edge no computador." });
      return;
    }
    const preset = fitPreset(getPreset(this.quality), this.cap);
    try {
      const tracks = await this.room.localParticipant.createScreenTracks({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        resolution: { width: preset.width, height: preset.height, frameRate: preset.frameRate },
        contentHint: preset.contentHint,
        surfaceSwitching: "include",
        systemAudio: "include",
        selfBrowserSurface: "exclude",
      });
      if (this.destroyed) return tracks.forEach((t) => t.stop());

      for (const t of tracks) {
        if (t instanceof LocalVideoTrack) {
          this.screenVideo = t;
          t.on(TrackEvent.Ended, () => void this.stopShare());
          await this.room.localParticipant.publishTrack(t, this.videoPublishOptions(preset));
        } else {
          this.screenAudio = t;
          await this.room.localParticipant.publishTrack(t, {
            source: Track.Source.ScreenShareAudio,
            dtx: false, // som de jogo/música é contínuo
            red: false,
            audioPreset: { maxBitrate: 96_000 },
          });
        }
      }
      if (!this.sharers().some((s) => !s.isMe)) this.watching = this.room.localParticipant.identity;
      this.emit({ sharing: true, shareError: "" });
      this.syncSubscriptions();
      this.refresh();
    } catch (err) {
      console.warn("[telinha] captura", err);
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") {
        this.emit({
          shareError: e.message?.includes("system")
            ? "O sistema bloqueou a captura de tela. Confira as permissões de captura de tela do Windows."
            : "A captura foi cancelada ou bloqueada.",
        });
      } else {
        this.emit({ shareError: `Não foi possível compartilhar a tela (${e?.name ?? "erro"}).` });
      }
    }
  }

  async stopShare() {
    const lp = this.room.localParticipant;
    if (this.screenVideo) await lp.unpublishTrack(this.screenVideo).catch(() => {});
    if (this.screenAudio) await lp.unpublishTrack(this.screenAudio).catch(() => {});
    this.screenVideo?.stop();
    this.screenAudio?.stop();
    this.screenVideo = null;
    this.screenAudio = null;
    if (this.watching === lp.identity) this.watching = null;
    this.emit({ sharing: false });
    this.syncSubscriptions();
    this.refresh();
  }

  /**
   * Troca a qualidade no meio da transmissão. As versões do simulcast são
   * definidas ao publicar, então republicamos a mesma captura (sem abrir o
   * seletor de tela de novo). Quem assiste vê uma piscada de ~1 segundo.
   */
  async setQuality(id: QualityId) {
    if (!isAllowed(getPreset(id), this.cap)) id = clampQuality(id, this.cap);
    this.quality = id;
    this.emit({ quality: id });
    const track = this.screenVideo;
    if (!track) return;
    const preset = fitPreset(getPreset(id), this.cap);
    const lp = this.room.localParticipant;
    try {
      await lp.unpublishTrack(track, false);
      track.mediaStreamTrack.contentHint = preset.contentHint;
      await track.mediaStreamTrack
        .applyConstraints({
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        })
        .catch(() => {});
      await lp.publishTrack(track, this.videoPublishOptions(preset));
    } catch (err) {
      console.warn("[telinha] troca de qualidade", err);
    }
    this.refresh();
  }

  private videoPublishOptions(p: QualityPreset) {
    const low = lowLayer(p);
    return {
      source: Track.Source.ScreenShare,
      videoCodec: "h264" as const,
      backupCodec: false,
      simulcast: true,
      screenShareEncoding: { maxBitrate: p.bitrate, maxFramerate: p.frameRate },
      screenShareSimulcastLayers: [new VideoPreset(low.width, low.height, low.bitrate, low.frameRate)],
      degradationPreference: p.degradation,
    };
  }

  // ---------- Estado pra interface ----------

  private refresh() {
    if (this.destroyed || this.room.state === "disconnected") return;
    const me = this.room.localParticipant;
    const speaking = new Set(this.room.activeSpeakers.map((p) => p.identity));
    const all: Participant[] = [me, ...this.room.remoteParticipants.values()];

    const people = all.map((p): PersonState => {
      const mic = p.getTrackPublication(Track.Source.Microphone);
      const isMe = p === me;
      return {
        id: p.identity,
        name: p.name || p.identity,
        isMe,
        muted: isMe ? this.muted || this.snapshot.mic !== "on" : !mic || mic.isMuted,
        speaking: speaking.has(p.identity) && !(isMe && this.muted),
        deafened: p.attributes?.deafened === "1",
        sharing: !!p.getTrackPublication(Track.Source.ScreenShare),
        poorConnection: p.connectionQuality === ConnectionQuality.Poor || p.connectionQuality === ConnectionQuality.Lost,
      };
    });

    this.emit({ people, shares: this.sharers(), watching: this.watching, stage: this.buildStage() });
  }

  private buildStage(): StageMedia | null {
    const id = this.watching;
    if (!id) return null;
    const me = this.room.localParticipant;
    const p: Participant | undefined = id === me.identity ? me : this.room.remoteParticipants.get(id);
    const video = p?.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (!p || !video) return null;
    const audio = p === me ? undefined : p.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
    return {
      key: `${p.identity}:${video.sid ?? video.mediaStreamTrack.id}:${audio?.sid ?? ""}`,
      video,
      audio,
      isMe: p === me,
      name: p.name || p.identity,
    };
  }

  private async collectStats() {
    if (document.hidden) return; // app minimizado: ninguém está olhando
    const stage = this.snapshot.stage;
    if (!stage) {
      if (this.snapshot.stats) this.emit({ stats: null });
      return;
    }
    if (stage.key !== this.statsKey) {
      this.statsKey = stage.key;
      this.prevStats = undefined;
    }
    try {
      const report = await stage.video.getRTCStatsReport();
      if (!report) return;
      const res = readVideoStats(report, stage.isMe ? "outbound" : "inbound", this.prevStats);
      if (!res) return;
      this.prevStats = res.snapshot;
      this.emit({ stats: res.stats });
    } catch {
      /* track trocando */
    }
  }

  // ---------- Infra ----------

  destroy() {
    this.destroyed = true;
    this.offCap();
    window.clearInterval(this.statsTimer);
    window.clearTimeout(this.graceTimer);
    this.screenVideo?.stop();
    this.screenAudio?.stop();
    void this.room.disconnect();
  }

  private emit(patch: Partial<RoomSnapshot>) {
    if (this.destroyed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.onChange(this.snapshot);
  }
}
