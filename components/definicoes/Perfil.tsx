"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import { useToast } from "../ui/Toast";

export function Perfil() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const router = useRouter();
  const [nome, setNome] = useState(s.nome);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function guardar() {
    setErro(null);
    if (p1 || p2) {
      if (p1.length < 10) { setErro("A palavra-passe tem de ter pelo menos 10 caracteres."); return; }
      if (p1 !== p2) { setErro("As palavras-passe não coincidem."); return; }
    }
    setAGuardar(true);
    const r = await (supabase as any).from("utilizadores").update({ nome: nome.trim() || s.nome }).eq("id", s.id);
    if (r.error) { setAGuardar(false); setErro("Não foi possível guardar o nome."); return; }
    if (p1) {
      const a = await supabase.auth.updateUser({ password: p1 });
      if (a.error) { setAGuardar(false); setErro("Não foi possível alterar a palavra-passe."); return; }
      setP1(""); setP2("");
    }
    setAGuardar(false);
    toast("Perfil guardado");
    router.refresh();
  }

  return (
    <div className="sblock">
      <h2>Perfil</h2>
      <p className="sdesc">Os teus dados nesta conta.</p>
      <div className="fld"><label className="fld-l" htmlFor="pf-nome">Nome</label><input id="pf-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="fld"><label className="fld-l" htmlFor="pf-email">Email</label><input id="pf-email" value={s.email} disabled /><p className="fld-h">O email é o teu acesso. Para o mudar, fala com quem administra a conta.</p></div>
      <div className="fld"><label className="fld-l" htmlFor="pf-ent">Entidade</label><input id="pf-ent" value={s.entidadeNome} disabled /><p className="fld-h">Só a TheStarter pode alterar o nome da entidade.</p></div>
      <h2 style={{ marginTop: 30 }}>Palavra-passe</h2>
      <p className="sdesc">Mínimo 10 caracteres. Deixa em branco para manter a atual.</p>
      <div className="fld"><label className="fld-l" htmlFor="pf-p1">Nova palavra-passe</label><input id="pf-p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
      <div className="fld"><label className="fld-l" htmlFor="pf-p2">Repetir</label><input id="pf-p2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      {erro ? <p className="err-msg">{erro}</p> : null}
      <button type="button" className="btn sm" style={{ marginTop: 8 }} disabled={aGuardar} onClick={() => void guardar()}>Guardar</button>
    </div>
  );
}
