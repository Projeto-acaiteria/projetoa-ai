"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/client";
import { Logo } from "@/components/site/Logo";
import { BRAND } from "@/config/brand";

// Tela de login do ComandaPRO (marca coral, front-stage). Fica fora do /admin (não passa pelo gate).
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

  const inp =
    "mb-4 w-full rounded-xl border px-3.5 py-3 outline-none transition focus:border-[color:var(--cor)] focus:ring-4";

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: BRAND.bgSoft }}>
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-3xl border bg-white p-8"
        style={{ borderColor: BRAND.line, boxShadow: BRAND.shadowCard, ["--cor" as string]: BRAND.coral }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo />
          <p className="mt-3 text-sm" style={{ color: BRAND.mut }}>Acesso ao painel</p>
        </div>

        <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className={inp}
          style={{ borderColor: BRAND.line, color: BRAND.ink, ["--tw-ring-color" as string]: BRAND.coralRing }}
        />

        <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          className={inp}
          style={{ borderColor: BRAND.line, color: BRAND.ink, ["--tw-ring-color" as string]: BRAND.coralRing }}
        />

        {erro && <p className="mb-3 text-sm font-medium" style={{ color: BRAND.coral }}>{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-xl py-3 font-bold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
          style={{ background: BRAND.coralGrad, boxShadow: BRAND.shadowCoral }}
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>

        <p className="mt-6 text-center text-sm" style={{ color: BRAND.mut }}>
          Ainda não tem loja?{" "}
          <a href="/cadastro" className="font-bold hover:underline" style={{ color: BRAND.coral }}>Criar grátis</a>
        </p>
      </form>
    </div>
  );
}
