import { redirect } from "next/navigation";
import { requireNavAccess } from "@/lib/auth/guard";

// "Shows" é o nome no menu; a rota real é /admin/eventos. Redireciona quem digita /admin/shows.
export default async function ShowsRedirect() {
  await requireNavAccess("/admin/shows");
  redirect("/admin/eventos");
}
