import { requireNavAccess } from "@/lib/auth/guard";
import { db } from "@/lib/supabase";
import { getStore } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import QrMesasClient from "./QrMesasClient";

export const dynamic = "force-dynamic";

// Aba QR das mesas (só lojas com mesa — gate no nav por hasTables). — ComandaPRO 3.9
export default async function QrMesasPage() {
  await requireNavAccess("/admin/qr-mesas");
  const storeId = await resolveStoreId();

  const [store, s, cfgRow, rows] = await Promise.all([
    getStore(storeId),
    db().from("stores").select("slug").eq("id", storeId).maybeSingle(),
    db().from("store_config").select("cover_enabled, has_delivery, qr_pedido_enabled").eq("store_id", storeId).maybeSingle(),
    db().from("tables").select("number").eq("store_id", storeId).order("number"),
  ]);

  const slug = (s.data as { slug?: string } | null)?.slug ?? "";
  const cfg = cfgRow.data as { cover_enabled?: boolean; has_delivery?: boolean; qr_pedido_enabled?: boolean } | null;
  const coverEnabled = !!cfg?.cover_enabled;
  const mesas = ((rows.data ?? []) as { number: number }[]).map((r) => r.number);

  return (
    <QrMesasClient
      storeName={store.name}
      slug={slug}
      accent={store.primaryColor || ""}
      coverEnabled={coverEnabled}
      // o card do balcão só promete "peça aqui" se a loja tiver delivery/retirada — senão o QR da
      // raiz é cardápio de leitura. E com o pedido pelo QR desligado, o card da mesa idem.
      balcaoPede={cfg?.has_delivery !== false}
      mesaPede={cfg?.qr_pedido_enabled !== false}
      mesas={mesas}
    />
  );
}
