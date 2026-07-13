// Base de clientes do vertical SERVICE (Starteq), com CPF como chave. Alimentada por:
//  (1) importação da base do GestãoClick (scripts/import-clientes-starteq.mjs) e
//  (2) cada check-in de OS (upsert automático).
// A recepção acha o cliente recorrente digitando o CPF. Tabela service-only (food não toca).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type ServiceCustomer = {
  cpf: string; // só dígitos (chave)
  name: string;
  phone: string; // como exibido (não normalizado) — pra auto-preencher o WhatsApp
  email?: string;
  address?: string;
  createdAt: string;
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export async function getServiceCustomerByCpf(cpf: string, storeId?: string): Promise<ServiceCustomer | null> {
  const key = onlyDigits(cpf);
  if (key.length < 3) return null;
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("service_customers").select("data").eq("store_id", sid).eq("cpf", key).maybeSingle();
  return data ? (data as { data: ServiceCustomer }).data : null;
}

/** Cria/atualiza o cliente pela chave CPF. Best-effort no check-in (não pode travar a abertura da OS). */
export async function upsertServiceCustomer(
  c: { cpf: string; name?: string; phone?: string; email?: string; address?: string },
  storeId?: string,
): Promise<void> {
  const key = onlyDigits(c.cpf);
  if (key.length < 3) return; // sem CPF válido não entra na base
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getServiceCustomerByCpf(key, sid);
  const rec: ServiceCustomer = {
    cpf: key,
    name: c.name?.trim() || cur?.name || "Cliente",
    phone: c.phone?.trim() || cur?.phone || "",
    email: c.email?.trim() || cur?.email,
    address: c.address?.trim() || cur?.address,
    createdAt: cur?.createdAt || new Date().toISOString(),
  };
  await db().from("service_customers").upsert({ store_id: sid, cpf: key, data: rec });
}
