import { redirect } from "next/navigation";

// "Shows" é o nome no menu; a rota real é /admin/eventos. Redireciona quem digita /admin/shows.
export default function ShowsRedirect() {
  redirect("/admin/eventos");
}
