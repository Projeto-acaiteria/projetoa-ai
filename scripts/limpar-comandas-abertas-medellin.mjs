// Limpeza das comandas que ficaram ABERTAS na noite de 25→26/07 no Medellín: a casa desistiu do
// sistema no meio da noite (bug do cupom + garçom novo sem acesso) e tocou no sistema antigo, então
// essas comandas nunca foram fechadas aqui — o consumo foi cobrado por fora.
//
// Replica o caminho do PRÓPRIO sistema (cancelTabItem em tables-store.ts:539): estorna o estoque,
// grava o log auditável em tab_item_cancellations e tira o item; comanda que esvazia (sem pagamento
// e sem couvert) é APAGADA e a mesa volta pra Livre — igual à lixeira da tela de Mesas.
//
// NÃO toca na comanda 226 (Mesa 20): ela tem R$50 de PIX REAL recebido pelo sistema, e o próprio
// código trava esse caso ("quem decide é o caixa"). Nem no caixa 57 — dinheiro é decisão do dono.
//
// Uso:  node scripts/limpar-comandas-abertas-medellin.mjs          (dry-run, não escreve nada)
//       node scripts/limpar-comandas-abertas-medellin.mjs --commit (executa)

import pg from "pg";
import { readFileSync } from "node:fs";

const COMMIT = process.argv.includes("--commit");
const STORE = "e2c9b699-8b92-4f95-a6b0-ef750a7721a4";
const TABS = [227, 228, 229];
const MOTIVO = "Noite 25/07: casa voltou pro sistema antigo, comanda nunca foi fechada aqui";
const POR = "limpeza operacional (Eduardo/Verbo)";

// mesma leitura do scripts/query.mjs — a senha tem "#" e quebra o parser de connectionString
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const [, user, password, host, port, database] = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();

const q = (sql, params) => client.query(sql, params).then((r) => r.rows);

// trava de segurança: nenhuma dessas comandas pode ter pagamento ou couvert
const guard = await q(
  `select t.id, t.cover_cents, coalesce(sum(p.amount_cents),0) as pago
     from tabs t left join tab_payments p on p.tab_id = t.id
    where t.id = any($1) and t.store_id = $2 group by t.id, t.cover_cents`,
  [TABS, STORE],
);
for (const g of guard) {
  if (Number(g.pago) > 0 || Number(g.cover_cents) > 0) {
    throw new Error(`comanda ${g.id} tem pagamento/couvert — NÃO é caso de limpeza, é decisão do caixa`);
  }
}
if (guard.length !== TABS.length) throw new Error("alguma comanda não existe nessa loja — abortado");

const itens = await q(
  `select i.id, i.name, i.size_label, i.qty, i.unit_price_cents, i.mods, i.consumes, i.tab_order_id, o.tab_id, t.label
     from tab_order_items i
     join tab_orders o on o.id = i.tab_order_id
     join tabs t on t.id = o.tab_id
    where o.tab_id = any($1) and i.store_id = $2
    order by o.tab_id, i.id`,
  [TABS, STORE],
);

console.log(COMMIT ? "=== EXECUTANDO ===" : "=== DRY-RUN (nada será escrito) ===");
let total = 0;
for (const it of itens) {
  total += it.qty * it.unit_price_cents;
  const cons = Array.isArray(it.consumes) ? it.consumes.filter((c) => c?.stockId && c.qty > 0) : [];
  const estoque = cons.length ? ` · estoque NÃO estornado (${cons.map((c) => c.stockId).join(", ")} em 0, evita fantasma)` : "";
  console.log(`  comanda ${it.tab_id} (${it.label}) · ${it.qty}x ${it.name} ${brl(it.qty * it.unit_price_cents)}${estoque}`);
}
console.log(`  ---\n  ${itens.length} itens · ${brl(total)} · ${TABS.length} comandas apagadas · ${TABS.length} mesas liberadas`);

if (!COMMIT) { await client.end(); process.exit(0); }

await q("begin");
try {
  for (const it of itens) {
    // ESTOQUE: NÃO estorna de propósito. A RPC move_stock corta a saída em zero
    // (`greatest(0, qty + delta)`) e o bar nunca deu entrada — os dois insumos estão em 0.000 com a
    // saída registrada no history. Devolver criaria estoque FANTASMA (2 águas e 1 Corona que não
    // existem na geladeira). O consumo foi real e cobrado por fora; o que não pode é inflar inventário.
    // 2) log auditável — sobrevive ao apagar da comanda (sem cascade)
    await q(
      `insert into tab_item_cancellations
         (store_id, tab_id, tab_order_id, item_name, size_label, qty, unit_price_cents, mods, reason, cancelled_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [STORE, it.tab_id, it.tab_order_id, it.name, it.size_label, it.qty, it.unit_price_cents, it.mods, MOTIVO, POR],
    );
    // 3) tira o item
    await q(`delete from tab_order_items where id = $1 and store_id = $2`, [it.id, STORE]);
  }
  // 4) pedidos vazios saem do KDS; a comanda vazia é apagada (não vira venda R$0) → mesa Livre
  await q(`delete from tab_orders where tab_id = any($1) and store_id = $2`, [TABS, STORE]);
  await q(`delete from tabs where id = any($1) and store_id = $2`, [TABS, STORE]);
  await q("commit");
  console.log("\n✓ commit");
} catch (e) {
  await q("rollback");
  console.error("✗ rollback:", e.message);
  process.exitCode = 1;
}

await client.end();
