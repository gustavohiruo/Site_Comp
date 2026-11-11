// Tela inicial: escolher nome, criar sala ou entrar numa.

import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Icon } from "../components/Icon";
import { SettingsDialog } from "../components/SettingsDialog";
import { generateCode, loadName, markCreator, normalizeCode, saveName } from "../core/storage";

export default function Home() {
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(loadName());
  const [nameError, setNameError] = useState(false);
  const [createPass, setCreatePass] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPass, setJoinPass] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const canShare = !!navigator.mediaDevices?.getDisplayMedia;

  /** Garante que a pessoa escolheu um nome antes de seguir */
  function ensureName(): boolean {
    const clean = name.trim();
    if (!clean) {
      setNameError(true);
      nameRef.current?.focus();
      return false;
    }
    saveName(clean);
    return true;
  }

  function createRoom(e: FormEvent) {
    e.preventDefault();
    if (!ensureName()) return;
    const code = generateCode();
    markCreator(code, createPass.trim());
    navigate(`/sala/${code}`);
  }

  function joinRoom(e: FormEvent) {
    e.preventDefault();
    if (!ensureName()) return;
    const code = normalizeCode(joinCode);
    if (!code) return;
    navigate(`/sala/${code}`, { state: { password: joinPass } });
  }

  return (
    <div className="page home">
      <header className="topbar">
        <Brand />
        <button className="btn ghost small" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" size={16} />
          <span className="hide-sm">Configurações</span>
        </button>
      </header>

      <main className="home-main">
        <section className="hero">
          <span className="eyebrow">
            <span className="live-dot" /> Compartilhamento de tela entre amigos
          </span>
          <h1>
            Sua tela, <em>ao vivo</em>,
            <br />
            pra quem importa.
          </h1>
          <p className="lede">
            Várias telas ao mesmo tempo, em até 60 fps, e cada um escolhe qual assistir. Leve pra rodar junto com o jogo, sem conta e sem anúncio
            nenhum.
          </p>

          <label className={`field name-field${nameError ? " has-error" : ""}`}>
            <span>Como te chamam?</span>
            <input
              ref={nameRef}
              value={name}
              maxLength={24}
              placeholder="Seu apelido"
              autoComplete="nickname"
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
            />
            {nameError && <small className="error-text">Escolhe um nome pra galera saber quem é.</small>}
          </label>
        </section>

        <div className="cards">
          <form className="card card-accent" onSubmit={createRoom}>
            <span className="card-icon">
              <Icon name="screen" size={20} />
            </span>
            <h2>Criar sala</h2>
            <p className="muted">Gera um código pra galera entrar.</p>
            <label className="field">
              <span>
                Senha <em className="optional">opcional</em>
              </span>
              <input
                type="password"
                value={createPass}
                onChange={(e) => setCreatePass(e.target.value)}
                placeholder="Deixe em branco pra sala aberta"
                autoComplete="new-password"
              />
            </label>
            {!canShare && <p className="note">Pra compartilhar, abre no computador (Chrome, Edge ou Firefox).</p>}
            <button className="btn primary block" type="submit">
              Criar sala <Icon name="arrow" size={16} />
            </button>
          </form>

          <form className="card" onSubmit={joinRoom}>
            <span className="card-icon">
              <Icon name="users" size={20} />
            </span>
            <h2>Entrar numa sala</h2>
            <p className="muted">Cole o código ou o link que te mandaram.</p>
            <label className="field">
              <span>Código</span>
              <input
                className="mono"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="abc-123"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </label>
            <label className="field">
              <span>
                Senha <em className="optional">se tiver</em>
              </span>
              <input
                type="password"
                value={joinPass}
                onChange={(e) => setJoinPass(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="btn block" type="submit">
              Entrar <Icon name="arrow" size={16} />
            </button>
          </form>
        </div>
      </main>

      <footer className="footer muted small">
        As telas passam pelo servidor de vocês, no PC parado. Nada de servidor de terceiros.
      </footer>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
