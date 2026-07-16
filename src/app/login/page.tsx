"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/client";

// Tela de login do ComandaPRO (Fase 2.3). Fica fora do /admin (não passa pelo gate).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setCarregando(false);
      setErro("E-mail ou senha inválidos.");
      return;
    }
    // despachante decide a porta pelo papel (operador → /sistema/leads, dono → /admin)
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1e1b4b] to-[#0f172a] px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-white backdrop-blur"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-wide">ComandaPRO</h1>
          <p className="mt-1 text-sm text-white/60">Acesso ao painel</p>
        </div>

        <label className="mb-1 block text-sm text-white/80">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mb-4 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 outline-none focus:border-indigo-400"
        />

        <label className="mb-1 block text-sm text-white/80">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          className="mb-4 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 outline-none focus:border-indigo-400"
        />

        {erro && <p className="mb-3 text-sm text-red-300">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>

        <p className="mt-5 text-center text-sm text-white/60">
          Ainda não tem loja? <a href="/cadastro" className="font-semibold text-indigo-300 hover:text-indigo-200">Criar grátis</a>
        </p>
      </form>
    </div>
  );
}
