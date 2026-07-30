import "server-only";
import { db } from "@/lib/supabase";

// Acesso do GARÇOM por CÓDIGO (mt-38). O dono gera um código de 6 dígitos na tela Garçons; o garçom
// instala o app e digita o código — sem email, sem senha, sem conta pra ninguém inventar.
//
// Por que código e não link que já loga: no iPhone o app instalado tem armazenamento SEPARADO do
// Safari. Link aberto no navegador logaria o Safari, e o ícone do app abriria deslogado — com o
// convite já queimado, o garçom ficaria preso. Com código, a sessão nasce DENTRO do app instalado,
// que é onde ela precisa estar, e a instrução é a mesma pra Android e iPhone.

// 30 DIAS (era 30 min) e REUTILIZÁVEL (29/07): enquanto a sessão do celular ainda pode cair, um
// código de uso único obrigava o garçom a ir no PC do caixa a cada queda — aconteceu 5 vezes numa
// noite no Medellín. Agora o código é do garçom: ele anota, reentra sozinho quantas vezes precisar.
// Quem corta o acesso é o dono, no "desconectar" ou excluindo o código — não o relógio.
const VALIDADE_MIN = 30 * 24 * 60;
const EMAIL_DOMINIO = "garcom.comandapro.net.br"; // conta sintética: ninguém digita, ninguém recebe email

export type Invite = { code: string; expiresAt: string };

const seisDigitos = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

/** Gera o código do garçom. NÃO mexe nos códigos vivos anteriores (regra do Eduardo 28/07): numa
 *  noite com vários garçons entrando, o dono gera vários e todos valem até serem usados, vencerem
 *  ou ele mandar excluir. Quem apaga é o dono, no botão — não o sistema por conta própria. */
export async function createInvite(staffId: string, storeId: string): Promise<Invite> {
  const d = db();
  const { data: staff } = await d.from("staff").select("id").eq("id", staffId).eq("store_id", storeId).maybeSingle();
  if (!staff) throw new Error("Garçom não encontrado nesta loja.");

  const expiresAt = new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString();
  // colisão com outro código VIVO (índice único) é rara, mas o retry evita explodir na cara do dono
  for (let i = 0; i < 8; i++) {
    const code = seisDigitos();
    const { error } = await d.from("staff_invites").insert({ store_id: storeId, staff_id: staffId, code, expires_at: expiresAt });
    if (!error) return { code, expiresAt };
  }
  throw new Error("Não consegui gerar o código agora. Tente de novo.");
}

/** Troca o código pela credencial de acesso do garçom. REUTILIZÁVEL: não queima no uso (29/07) —
 *  o garçom reentra com o mesmo número quantas vezes precisar, sem ir ao PC do caixa. Morre só por
 *  validade (30 dias) ou porque o dono desconectou/excluiu. Devolve null se o código não existe ou
 *  venceu — o chamador não distingue os casos (não entrega pista pra quem fica chutando código). */
export async function consumeInvite(code: string): Promise<{ email: string; password: string } | null> {
  const d = db();
  const limpo = code.replace(/\D/g, "");
  if (limpo.length !== 6) return null;

  const agora = new Date().toISOString();
  const { data: rows } = await d.from("staff_invites")
    .select("store_id, staff_id")
    .eq("code", limpo).is("used_at", null).gt("expires_at", agora)
    .limit(1);
  const inv = (rows ?? [])[0] as { store_id: string; staff_id: string } | undefined;
  if (!inv) return null;

  const email = `garcom-${inv.staff_id}@${EMAIL_DOMINIO}`;
  const password = crypto.randomUUID() + crypto.randomUUID(); // ninguém digita: some depois do login
  const sb = db();

  const criado = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  let userId = criado.data?.user?.id;
  if (criado.error) {
    if (!/already|registered|exists/i.test(criado.error.message)) throw criado.error;
    const list = await sb.auth.admin.listUsers({ perPage: 1000 });
    userId = list.data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) throw criado.error;
    // rotaciona a senha: o celular ANTIGO do garçom perde a credencial (troca de aparelho, demissão)
    await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
  }

  const { data: exist } = await sb.from("store_members").select("id").eq("store_id", inv.store_id).eq("user_id", userId).maybeSingle();
  if (exist) await sb.from("store_members").update({ role: "waiter", active: true, staff_id: inv.staff_id }).eq("id", (exist as { id: string }).id);
  else await sb.from("store_members").insert({ store_id: inv.store_id, user_id: userId, role: "waiter", active: true, staff_id: inv.staff_id });

  return { email, password };
}

export type AcessoGarcom = { conectado: boolean; codigos: { id: string; code: string; expiresAt: string }[] };

/** Situação do acesso pra tela do dono: está conectado? quais códigos dele ainda valem?
 *  Devolve os códigos VISÍVEIS de propósito — o dono gera pra 3 garçons e mostra pra cada um na
 *  hora que chegar, sem precisar gerar de novo porque o modal fechou. */
export async function accessStatus(storeId: string): Promise<Record<string, AcessoGarcom>> {
  const d = db();
  const agora = new Date().toISOString();
  const [{ data: membros }, { data: convites }] = await Promise.all([
    d.from("store_members").select("staff_id, active").eq("store_id", storeId).eq("role", "waiter"),
    d.from("staff_invites").select("id, staff_id, code, expires_at").eq("store_id", storeId).is("used_at", null).gt("expires_at", agora).order("created_at"),
  ]);
  const out: Record<string, AcessoGarcom> = {};
  const slot = (id: string) => (out[id] ??= { conectado: false, codigos: [] });
  for (const m of (membros ?? []) as Array<{ staff_id: string | null; active: boolean }>) {
    if (m.staff_id) slot(m.staff_id).conectado = !!m.active;
  }
  for (const c of (convites ?? []) as Array<{ id: string; staff_id: string; code: string; expires_at: string }>) {
    slot(c.staff_id).codigos.push({ id: c.id, code: c.code, expiresAt: c.expires_at });
  }
  return out;
}

/** Apaga UM código (o dono clicou em excluir). Só o dono decide matar código vivo. */
export async function deleteInvite(inviteId: string, storeId: string): Promise<void> {
  await db().from("staff_invites").delete().eq("id", inviteId).eq("store_id", storeId);
}

/** Desconecta o garçom: o acesso morre na requisição seguinte (getCurrentStore exige active=true).
 *  Queima também o código vivo dele — senão "desconectei" deixaria uma porta aberta na gaveta. */
export async function revokeAccess(staffId: string, storeId: string): Promise<void> {
  const d = db();
  await d.from("store_members").update({ active: false }).eq("store_id", storeId).eq("staff_id", staffId).eq("role", "waiter");
  await d.from("staff_invites").update({ used_at: new Date().toISOString() }).eq("store_id", storeId).eq("staff_id", staffId).is("used_at", null);
}

/** Faxina de fim de temporada: derruba TODOS os garçons de uma vez. Quem ainda trabalha na casa
 *  reentra com um código novo em 15 segundos. Não toca em dono/recepção. */
export async function revokeAllWaiters(storeId: string): Promise<number> {
  const d = db();
  const { data } = await d.from("store_members").update({ active: false })
    .eq("store_id", storeId).eq("role", "waiter").eq("active", true).select("id");
  await d.from("staff_invites").update({ used_at: new Date().toISOString() }).eq("store_id", storeId).is("used_at", null);
  return (data ?? []).length;
}
