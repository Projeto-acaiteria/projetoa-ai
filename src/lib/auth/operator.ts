import { getCurrentUser } from "@/lib/auth/store";

// Operador do SaaS (Impulso/Eduardo) — NÃO é dono de loja. Enxerga dados globais (leads).
// Lista vem de OPERATOR_EMAILS (csv na Vercel); fallback = o email do Eduardo, pra funcionar
// sem depender de env. Comparação sempre em lowercase.
const DEFAULT_OPERATORS = ["edubchaves5@gmail.com"];

export function operatorEmails(): string[] {
  const env = (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return env.length ? env : DEFAULT_OPERATORS;
}

export function isOperatorEmail(email?: string | null): boolean {
  if (!email) return false;
  return operatorEmails().includes(email.toLowerCase());
}

// Retorna o operador logado ou null (pra o layout/rota decidir o redirect/403).
export async function requireOperator(): Promise<{ email: string } | null> {
  const user = await getCurrentUser();
  if (!user?.email || !isOperatorEmail(user.email)) return null;
  return { email: user.email };
}
