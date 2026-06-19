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
    const { data } = await db().from("stores").select("*").eq("owner_id", user.id).maybeSingle();
    if (data) return data as Store;
  }
  return null;
});
