---
name: "ComandaPRO — Design System"
version: "1.0"
description: "Sistema de design do ComandaPRO (SaaS food-service multi-segmento). Núcleo premium compartilhado + override por segmento. Fonte ÚNICA da aparência — espelha src/app/globals.css."
mirror: "src/app/globals.css (@theme + :root). Mudou token aqui → muda lá no mesmo commit, e vice-versa (λ.prova-na-fonte)."
segment_overrides: ["acai", "bar", "grid"]

# ── Tokens (machine-readable; o agente referencia por NOME, nunca hex solto) ──
colors:
  # Brand / acento — ÍNDIGO. Usar com PARCIMÔNIA: só CTA primário, item ativo, foco, link.
  brand-900: "#312E81"
  brand-800: "#3730A3"
  brand-700: "#4338CA"   # active/press
  brand-600: "#4F46E5"   # primary (CTA)
  brand-500: "#6366F1"   # hover
  brand-400: "#818CF8"   # anel de foco / acento claro
  # Surface ladder (claro — o admin é light-only)
  canvas:    "#FFFFFF"   # card
  bg:        "#F8FAFC"   # fundo da página (slate-50)
  surface-2: "#F1F5F9"   # superfície secundária (slate-100)
  border:    "#E2E8F0"   # linha (slate-200)
  # Text ladder (slate)
  ink:       "#0F172A"   # primário
  ink-2:     "#334155"   # secundário
  ink-muted: "#64748B"   # terciário
  ink-faded: "#94A3B8"   # quaternário
  # Semantic — CRÍTICO. Cor = STATUS, nunca decoração.
  success:   "#16A34A"   # PAGO / quitado / positivo / "grátis". VERDE SÓ AQUI.
  warning:   "#F59E0B"   # pendente / a receber / atenção
  danger:    "#EF4444"   # cancelado / estorno / erro
  accent-gold: "#B45309" # "premium/pago" (âmbar). NÃO confundir com brand.

typography:
  font-family: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  # Princípio: TAMANHO É HIERARQUIA. Número herói ~3x o secundário. (token · size · weight · tracking · uso)
  hero:      "48-60px (text-5xl/6xl) · 600 · -0.02em · número herói (faturado hoje, saldo)"
  display:   "30px (text-3xl) · 700 · -0.01em · KPI secundário / título de tela"
  h2:        "20px (text-xl) · 800 · normal · seções"
  body:      "16px (text-base) · 400 · normal · texto padrão"
  body-sm:   "14px (text-sm) · 400/600 · normal · labels, tabela"
  caption:   "11-12px (text-xs) · 600 · 0.02em uppercase · badges, metadados"
  numeric:   "use tabular-nums em TODO valor R$, peso (g), pontos (alinha as colunas)"

spacing:    # grade 8pt (escala default do Tailwind — nunca p-[13px]). interna ≤ externa.
  card-padding: "24px (p-6)"
  card-gap:     "16px (gap-4)"
  section:      "48px (space-y-12 / mt-12)"
  page:         "px-6 md:px-8 lg:px-8 · py-8 lg:py-7"

rounded:
  sm: "8px (rounded-lg)"    # inputs, pills, botões pequenos
  md: "12px (rounded-xl)"   # botões, cards
  lg: "20px (rounded-2xl)"  # modais, painéis, cards grandes
  full: "9999px"            # pílulas de status, avatares

elevation:  # sombra TINGIDA de slate (não preto puro), 1 fonte de luz (acima-esquerda)
  card:    "0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06)"   # --shadow-card
  pop:     "0 12px 40px rgba(15,23,42,0.18)"                                  # --shadow-pop (popover/drawer)
  brand:   "0 10px 30px rgba(79,70,229,0.30)"                                 # --shadow-brand (glow do CTA)
  border-as-shadow: "0 0 0 1px rgba(15,23,42,0.08)"  # borda translúcida (assinatura Vercel)

motion:
  easing:   "cubic-bezier(0.175, 0.885, 0.32, 1.1)"   # ease-out com leve overshoot (o 'snap' premium)
  state:    "150ms"   # hover/press/toggle (alta frequência)
  popover:  "200ms"   # tooltip/dropdown
  modal:    "300ms"   # overlays/entradas
  tactile:  "≤100ms"  # feedback de toque (active)
  animate:  "SÓ transform + opacity (GPU). NUNCA width/height/top/left/margin/box-shadow."
  reduced:  "respeitar prefers-reduced-motion (já tratado no globals.css)"

zindex:  "drawer 150 → modal 300 (modal SEMPRE acima do drawer) → confirm 70 (no contexto do editor)"
---

## Overview / Atmosfera

Ferramenta de **trabalho**, não landing. Operacional, limpa, densidade calma. **A era da densidade acabou:** o painel responde *"tá tudo ok?"* em < 2s. Premium aqui = **subtrair até sobrar só o que decide**, e dar a esse pouco **tamanho, respiro e contraste** — não brilho.

Acento **índigo com parcimônia** (só CTA primário, item ativo no nav, foco, link). O peso operacional é carregado pelas **cores semânticas** (pago/pendente/cancelado). Prioridade absoluta: **mobile** (o dono e o garçom operam no celular — `λ.mobile-é-o-principal`) e **menos cliques** (`λ.menos-cliques`).

## Hierarquia (regra mestra)

**Tamanho é hierarquia.** O número principal de cada tela (faturado hoje, saldo, total da conta) é ~**3x maior** que os secundários e fica no quadrante superior-esquerdo. **5–9 elementos** por tela, não 50. Traduzir dado cru em desfecho ("Você faturou R$375" > "vendas: 12").
- **DO:** um foco por tela. Hero `text-5xl/6xl` semibold tracking-tight; KPIs `text-3xl`; corpo `text-sm`.
- **DON'T:** 5 cards do mesmo tamanho/tipografia (lê como planilha).

## Cores

Camadas brand / surface / text / semantic — ver frontmatter. **Regra dura:** VERDE (`success`) é **exclusivo** de status pago/quitado/grátis. Índigo é **acento** (nunca área grande). Toda cor de status acompanha **label textual** (acessibilidade: nunca só cor).

## Tipografia

Adotar **Inter** (fonte de marca premium — Linear usa). Hierarquia: ver frontmatter. `tabular-nums` em todo valor monetário/peso/pontos. Razão herói:secundário ~3x.

## Espaçamento

Grade **8pt**. Card `p-6`, grid `gap-4`, seções `space-y-12`, página `px-8 py-7`. **Interna ≤ externa** (padding do card ≤ gap entre seções) — senão o agrupamento Gestalt desmorona. Proximidade comunica relação; use o gap, não bordas.

## Elevação & profundidade

Sombra tingida de slate, 1 fonte de luz (acima-esquerda), mesma proporção na página toda. Card em repouso = `elevation.card`. Borda preferir `border-as-shadow` (translúcida, funciona sobre qualquer fundo). **Hover de card:** `translateY(-4px)` + sombra maior — animar **só transform**.

## Formas

Raio: `rounded-lg` (8px) inputs/pills, `rounded-xl` (12px) botões/cards, `rounded-2xl` (20px) modais/painéis.

## Componentes (os 6 microestados — é onde a UI premium aparece)

**button-primary** (`brand-gradient`/`brand-600`, texto branco):
- default · **hover** sobe pra brand-500 · **active** brand-700 + `scale(0.98)` (≤100ms) · **focus-visible** anel 2 camadas `0 0 0 2px canvas, 0 0 0 4px brand-400` · **disabled** `opacity-50 cursor-not-allowed` sem hover/foco · **loading** largura TRAVA (sem reflow), label vira gerúndio ("Salvando…") + `aria-busy`.
- transição `150ms` na easing padrão. Animar cor/transform, nunca largura.

**button-secondary**: `surface-2`/`canvas`, texto `ink`, borda `border-as-shadow`. Mesmos 6 estados.

**card**: `canvas`, borda `border`, `rounded-xl`, `p-6`, `elevation.card`. Hover (se clicável) lift.

**input**: `canvas`, borda `border`, `rounded-lg`, h-40px. **focus** mesmo anel do botão. **error** borda+texto `danger` + `aria-invalid`+`aria-describedby`+`role=alert`. Validar no **blur/submit**, não a cada tecla.

**status-badge**: pílula `rounded-full`, cor = semantic conforme estado, **sempre com label**.

**thermal-receipt** (cravado): corpo 72mm/80mm, cabeçalho (nome/endereço/Tel/CNPJ), **SEMPRE negrito**, "NÃO É DOCUMENTO FISCAL". Ver `feedback_padrao_cupom_impressao`.

## Card premium (KPI / número-herói — padrão palace)

Aprendido do palace-system (adaptado ao nosso light/índigo). Aplicar em cards de **dashboard** (Início, Caixa, Financeiro) — NÃO em cards de info comuns:
- **Gradiente sutil** no fundo: `linear-gradient(135deg, color-mix(in srgb, <tom> 6-8%, var(--bg-elevated)) 0%, var(--bg-elevated) 60%)`.
- **Glow orb** no canto sup-direito: `absolute -right-8 -top-10 rounded-full blur-2xl` com `color-mix(in srgb, <tom> 20%, transparent)`.
- **Linha de acento** no topo: `absolute inset-x-0 top-0 h-[2px]` com `linear-gradient(90deg, <tom>, transparent)`.
- **Label** `text-[11px] uppercase tracking-widest`; **valor** com `tabular-nums`. `<tom>` = cor semântica (brand/green/gold).
- Já encapsulado no `StatCard` (components/admin/ui.tsx) e no hero do Início/Caixa.

## Stagger reveal & hover (globals.css)
- `.stagger-item` — entra em cascata (fade-up, delays 0/70/140/210ms; respeita `prefers-reduced-motion`). Nos KPIs/listas de uma tela que carrega.
- `.card-hover` — lift opt-in (`translateY(-3px)` + `--shadow-pop` + borda brand-400) **só** em card CLICÁVEL.

## Estados vazios

Ícone (SVG) → headline (o que é/por que vazio) → texto curto → **1 CTA** (máx 2). O 1º empty state **É onboarding** — trate como tela de partida ("Criar 1º produto"), não erro. Copy: "duas partes instrução, uma parte simpatia".

## Loading

**Skeleton** quando busca conteúdo com layout previsível (listas, dashboard, tabela, cards) — replica o esqueleto final, shimmer da esquerda→direita, só liga se load > ~2.5s. **Spinner** quando ação curta e bloqueante (salvar, login, pagamento).

## Toasts / feedback

Confirmação 2–3s · com ação 5–6s · pausa auto-dismiss no foco de teclado. Posição bottom-center (no mobile acima das barras). Variante semântica = cor + ícone SVG (nunca só cor). Entra ease-out, sai ease-in, anima transform+opacity ~200–300ms. Botão fechar sempre disponível.

## Loyalty / Fidelidade (premium, anti-cafona)

Regra de negócio: pontos → troca por **item inteiro**, **NUNCA** vira desconto em R$ (`feedback_pontos_nao_misturam_com_pagamento`). Isso É o posicionamento premium (presente, não cupom de desconto barato).
- **Progresso sempre na home** do cliente, com a meta em **item**: *"Faltam 2 açaís pro seu açaí grátis"* > "780 pts". Goal-gradient.
- **Barra LINEAR** pro número crítico (mais legível que anel). Anel só decorativo (streak).
- **Feedback no momento da compra:** "+15 pontos" com count-up + barra animando.
- **Celebração RARA e proporcional:** ganho comum = só pulse/glow; resgate = confete curto (paleta da marca); marco/tier = takeover (o copo enchendo + dourado). Confete em tudo = mata a raridade (Duolingo: +1.7% retenção só por gatear isso).
- **Moeda com nome da marca** (ex: "Sementes/Polpas"), **foto real** dos prêmios, **selos com profundidade (SVG, nunca emoji)**, **endowed progress** (cliente nasce com progresso "de graça").
- **Resgate em 3 passos:** escolher (card com custo em pts + estado) → confirmar 1-clique (mostra saldo pós) → micro-celebração + voucher. No cupom: "AÇAÍ 500ml — PRÊMIO FIDELIDADE (0,00)", nunca "desconto R$18".

## Do's & Don'ts

- **DO:** ícone SEMPRE SVG inline (`components/Icons.tsx`). **NUNCA emoji em UI** (`feedback_sempre_svg_nunca_emoji`).
- **DO:** status = cor semântica + label textual. **DO:** comprimir foto client-side (webp) antes de upload (`feedback_comprimir_fotos_upload`).
- **DO:** `tabular-nums` em valores. **DO:** foto real/curada (nunca picsum/IA com pessoa).
- **DON'T:** verde fora de status pago. **DON'T:** índigo em área grande (só acento). **DON'T:** 2+ acentos competindo.
- **DON'T:** CTA abaixo da dobra no mobile. **DON'T:** valores fora da escala 8pt. **DON'T:** animar largura/altura/box-shadow.

## Responsivo (tri-modal — `feedback_estrategia_tri_modal_breakpoints`)

| Nome | Largura | Mudanças |
|---|---|---|
| Mobile | < 640px | painel lateral vira drawer; tabela vira card-list; CTA visível sem rolar; grids de pagamento 2-col |
| Tablet | 640–1023px | `md:` 2-col; drawer ainda |
| Desktop | ≥ 1024px | `lg:` painéis fixos, grade completa |

**Touch ≥ 44px.** Mobile é O front principal — **validar a 390–414px (puppeteer/device) antes de declarar pronto.** Isolar mobile/desktop com prefixo Tailwind (`sm:`); sem prefixo afeta os dois.

## Iteration Guide (pro coding agent = eu)

1. **Uma tela/componente por rodada** — valida, depois a próxima (`λ.uma-secao-por-rodada`).
2. Referencie cores/spacing pelo **nome do token** (`brand-600`, `gap-4`), nunca hex solto.
3. Antes de "pronto": **rodar no mobile real (390px)**.
4. Mudou token no globals.css? **Atualize este arquivo no mesmo commit** (espelho obrigatório — `λ.prova-na-fonte`).

## Segment Overrides (white-label — só `colors` e "atmosfera" trocam; componentes/spacing/responsive idênticos)

### acai
Cardápio PÚBLICO: roxo `#7C3AED` + dourado `#D4AF37`, tema ESCURO, estilo sushi (banner-foto por seção) — `project_cantinho_acai_identidade_visual`. O ADMIN segue índigo (sistema). Loyalty é forte aqui.

### bar
Couvert/taxa 10%/dose visíveis no fluxo. Sem delivery por padrão. Admin índigo.

### grid (restaurante/pizza/sushi/marmita/hambúrguer)
Cardápio público com foto grande (estilo iFood). Pizza = builder meio-a-meio. Admin índigo.

> O cardápio PÚBLICO usa a cor de CADA loja (`store.primaryColor`, white-label). O SISTEMA (admin/login/cadastro) é sempre índigo. Não misturar.
