import { cache } from "react";
import { createClient } from "@/lib/auth/server";
import { db } from "@/lib/supabase";

// A loja (tenant) resolvida a partir do usuário logado. 1 conta = 1 loja (owner_id).
export type Store = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  owner_id: string | null;
  active: boolean;
};

// Usuário logado — cache() garante 1 chamada por request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Loja do dono logado. Retry backoff (lição AgendaPRO): logo após o signup o Supabase
// devolve null transitório — 0/200/400/600ms cobre isso.
export const getCurrentStore = cache(async (): Promise<Store | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  for (const delay of [0, 200, 400, 600]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    // dono da loja
    const { data } = await db().from("stores").select("*").eq("owner_id", user.id).maybeSingle();
    if (data) return data as Store;
    // funcionário: resolve a loja pela membership ativa (recepção/técnico não têm owner_id)
    const { data: m } = await db().from("store_members").select("store_id").eq("user_id", user.id).eq("active", true).maybeSingle();
    if (m) {
      const { data: s } = await db().from("stores").select("*").eq("id", (m as { store_id: string }).store_id).maybeSingle();
      if (s) return s as Store;
    }
  }
  return null;
});

export type Role = "owner" | "reception" | "technician" | "waiter";
export type Membership = { store: Store; role: Role; technicianId: string | null; staffId: string | null };

// Papel do usuário logado na loja resolvida. Owner = dono (owner_id) OU member role=owner.
export const getCurrentMembership = cache(async (): Promise<Membership | null> => {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStore()]);
  if (!user || !store) return null;
  if (store.owner_id === user.id) return { store, role: "owner", technicianId: null, staffId: null };
  const { data: m } = await db()
    .from("store_members")
    .select("role, technician_id, staff_id")
    .eq("store_id", store.id).eq("user_id", user.id).eq("active", true)
    .maybeSingle();
  const row = m as { role?: string; technician_id?: string | null; staff_id?: string | null } | null;
  const role: Role = row?.role === "owner" ? "owner" : row?.role === "technician" ? "technician" : row?.role === "waiter" ? "waiter" : "reception";
  return { store, role, technicianId: row?.technician_id ?? null, staffId: row?.staff_id ?? null };
});

export const getCurrentRole = cache(async (): Promise<Role | null> => {
  return (await getCurrentMembership())?.role ?? null;
});
