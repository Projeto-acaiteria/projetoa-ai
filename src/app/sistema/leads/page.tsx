import { db } from "@/lib/supabase";
import { getNicho } from "@/config/marketing";
import { BRAND } from "@/config/brand";

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
      <h1 className="text-xl font-bold" style={{ color: BRAND.ink }}>Leads</h1>
      <p className="mt-1 text-sm" style={{ color: BRAND.mut }}>Quem preencheu o modal de captura — inclusive quem não terminou o cadastro.</p>

      {/* contadores */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Novos" value={novos} tone="coral" />
        <Stat label="Convertidos" value={convertidos} tone="green" />
        <Stat label="Conversão" value={`${taxa}%`} tone="ink" />
      </div>

      {leads.length === 0 ? (
        <p className="mt-10 text-center text-sm" style={{ color: BRAND.mut }}>Nenhum lead ainda. Assim que alguém preencher o modal, aparece aqui.</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {leads.map((l) => (
            <li key={l.id} className="rounded-2xl border bg-white p-4" style={{ borderColor: BRAND.line, boxShadow: BRAND.shadowCard }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold" style={{ color: BRAND.ink }}>{l.name}</span>
                    {l.status === "convertido" ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#E6F5EC", color: "#0f9d58" }}>convertido</span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: BRAND.coral }}>novo</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-sm" style={{ color: BRAND.ink2 }}>{l.business_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: BRAND.mut }}>
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
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#22A45D" }}
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

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "coral" | "green" | "ink" }) {
  const color = tone === "coral" ? BRAND.coral : tone === "green" ? "#0f9d58" : BRAND.ink;
  return (
    <div className="rounded-2xl border bg-white p-3 text-center" style={{ borderColor: BRAND.line }}>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: BRAND.mut }}>{label}</div>
    </div>
  );
}
