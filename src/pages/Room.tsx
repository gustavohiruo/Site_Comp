// Rota /sala/:codigo — pede o nome (se precisar) e abre a sala.

import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Icon } from "../components/Icon";
import { getCreatorIntent, loadName, normalizeCode, saveName } from "../core/storage";
import RoomView from "./RoomView";

export default function Room() {
  const { code: raw = "" } = useParams();
  const location = useLocation();
  const code = normalizeCode(raw);
  const [name, setName] = useState(loadName());

  if (!code) return <Navigate to="/" replace />;

  // Quem chegou direto pelo link ainda não tem nome
  if (!name) return <NameGate onDone={setName} />;

  // Quem criou a sala nesta aba pede pra criar (ou reentrar, se der F5)
  const creator = getCreatorIntent(code);
  const password = creator?.password ?? (location.state as { password?: string } | null)?.password ?? "";
  return <RoomView key={code} code={code} name={name} initialPassword={password} create={!!creator} />;
}

function NameGate({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (!clean) return;
    saveName(clean);
    onDone(clean);
  }

  return (
    <div className="page">
      <header className="topbar">
        <Brand />
      </header>
      <main className="center">
        <form className="card narrow" onSubmit={submit}>
          <span className="card-icon">
            <Icon name="users" size={20} />
          </span>
          <h2>Antes de entrar…</h2>
          <p className="muted">Como te chamam? É assim que o pessoal vai te ver na sala.</p>
          <label className="field">
            <span>Seu apelido</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={24} autoFocus required />
          </label>
          <button className="btn primary block" type="submit">
            Entrar na sala <Icon name="arrow" size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}
