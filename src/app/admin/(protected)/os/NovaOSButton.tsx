import Link from "next/link";

// "+ Nova OS" agora leva pra PÁGINA de check-in (/admin/os/nova) — não é mais modal.
// Página inteira com seções dá familiaridade (estilo GestãoClick) e evita o modal flutuante.
export default function NovaOSButton() {
  return (
    <Link href="/admin/os/nova" className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">
      + Nova OS
    </Link>
  );
}
