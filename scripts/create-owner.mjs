import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.+)", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const EMAIL = "cantinho@comandapro.app", PASSWORD = "cantinho2026";
let userId;
const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === EMAIL)?.id;
    console.log("usuario ja existia:", userId);
  } else { console.error("erro createUser:", error.message); process.exit(1); }
} else { userId = data.user.id; console.log("dono criado:", userId); }
const { error: uErr } = await admin.from("stores").update({ owner_id: userId }).eq("slug", "cantinho-do-acai");
if (uErr) { console.error("erro vincular:", uErr.message); process.exit(1); }
console.log("vinculado. login:", EMAIL, "/", PASSWORD);
