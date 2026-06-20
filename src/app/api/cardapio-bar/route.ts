import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import {
  readBarMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  createGroup,
  updateGroup,
  deleteGroup,
  createModifier,
  updateModifier,
  deleteModifier,
} from "@/lib/menu-bar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CRUD do cardápio modelo BAR (editor admin). A loja vem do dono logado (resolveStoreId).
// GET → menu completo (inclui inativos). POST {action, payload} → cria/edita/exclui.
export async function GET() {
  const storeId = await resolveStoreId();
  const categories = await readBarMenu(storeId, true);
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const storeId = await resolveStoreId();
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};
  try {
    switch (b.action) {
      case "cat.create": {
        const c = await createCategory(p as never, storeId);
        return NextResponse.json({ ok: true, id: c.id });
      }
      case "cat.update":
        await updateCategory(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "cat.delete":
        await deleteCategory(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      case "prod.create": {
        const prod = await createProduct(p as never, storeId);
        return NextResponse.json({ ok: true, id: prod.id });
      }
      case "prod.update":
        await updateProduct(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "prod.delete":
        await deleteProduct(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      case "group.create": {
        const g = await createGroup(p as never, storeId);
        return NextResponse.json({ ok: true, id: g.id });
      }
      case "group.update":
        await updateGroup(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "group.delete":
        await deleteGroup(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      case "mod.create": {
        const mo = await createModifier(p as never, storeId);
        return NextResponse.json({ ok: true, id: mo.id });
      }
      case "mod.update":
        await updateModifier(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "mod.delete":
        await deleteModifier(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("cardapio-bar:", e);
    return NextResponse.json({ error: "Não consegui salvar. Tente de novo." }, { status: 500 });
  }
}
