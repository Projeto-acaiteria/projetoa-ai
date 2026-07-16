import { db } from "@/lib/supabase";
import { getNicho } from "@/config/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads · ComandaPRO", robots: { index: false } };

type Lead = {
  id: string;
  name: string;
  whatsapp: string;
  business_name: string;
  source: string;
  status: string;
  created_at: string;
};

// rótulo legível da origem: 'home' → Home; slug de nicho → nome do nicho; senão o próprio slug
function sourceLabel(source: string): string {
  if (source === "home") return "Home";
  return getNicho(source)?.nome ?? source;
}

function fmtData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Araguaina", // Palmas/TO (UTC-3)
  }).format(new Date(iso));
}

// mensagem pré-pronta do follow-up (tom direto). O operador edita antes de mandar se quiser.
function waLink(l: Lead): string {
  const primeiroNome = l.name.trim().split(/\s+/)[0];
  const msg =
    `Oi ${primeiroNome}, aqui é o Eduardo da Impulso Digital. ` +
    `Vi que você começou a montar o ComandaPRO pro ${l.business_name}. ` +
    `Quer que eu te ajude a deixar pronto pra receber pedido hoje?`;
  return `https://wa.me/55${l.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export default async function LeadsPage() {
  const { data } = await db()
    .from("leads")
    .select("id, name, whatsapp, business_name, source, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const leads = (data ?? []) as Lead[];

  const novos = leads.filter((l) => l.status === "novo").length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const taxa = leads.length ? Math.round((convertidos / leads.length) * 100) : 0;

  return (
    <div>
      <h1 className="text-xl font-bold">Leads</h1>
      <p className="mt-1 text-sm text-white/50">Quem preencheu o modal de captura — inclusive quem não terminou o cadastro.</p>

      {/* contadores */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Novos" value={novos} tone="amber" />
        <Stat label="Convertidos" value={convertidos} tone="emerald" />
        <Stat label="Conversão" value={`${taxa}%`} tone="indigo" />
      </div>

      {leads.length === 0 ? (
        <p className="mt-10 text-center text-sm text-white/40">Nenhum lead ainda. Assim que alguém preencher o modal, aparece aqui.</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {leads.map((l) => (
            <li key={l.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{l.name}</span>
                    {l.status === "convertido" ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">convertido</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">novo</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-white/70">{l.business_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                    <span>{fmtData(l.created_at)}</span>
                    <span>·</span>
                    <span>{sourceLabel(l.source)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{l.whatsapp}</span>
                  </div>
                </div>
                <a
                  href={waLink(l)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "amber" | "emerald" | "indigo" }) {
  const ring = tone === "amber" ? "text-amber-300" : tone === "emerald" ? "text-emerald-300" : "text-indigo-300";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <div className={`text-2xl font-extrabold tabular-nums ${ring}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}
