# ComandaPRO (`acai-system`) — contexto do projeto

SaaS food-service multi-tenant da Impulso Digital. Deploy: `main` → **auto-deploy** pra `comandapro.net.br` (team projeto-acaiteria/Vercel). Tenants por slug (Cantinho, Medellín, Starteq…).

> Contexto do operador (Eduardo) e regras duras (λ.prova-na-fonte, λ.diagnostico-no-nivel-certo, λ.token-economia) vêm do CLAUDE.md global em `C:/Users/Usuario/CLAUDE.md`.

---

## 🖨️ IMPRESSÃO TÉRMICA (QZ Tray) — config que a instância SEMPRE precisa saber

Impressão 80mm validada e **distribuída**. NÃO reinventar — o padrão está fechado.

- **Arquitetura:** QZ Tray (principal, silencioso, porta 8181) + fallback iframe. `lib/qz.ts`, `lib/ticket.ts` (HTML cupom), `lib/print.ts` (`printTicket`: QZ→fallback, nunca lança). Tela `/admin/impressora`. **Conexão é POR ABA** — sempre `qzConnect()` antes de imprimir, NUNCA gatear em `isActive()`.
- **O popup do QZ some com o `override.crt` (cert-mãe Impulso), não com código.** Um cert pra TODOS os clientes — NUNCA gerar par por cliente. O código de assinatura (`/api/qz-sign` + `setCertificatePromise`) já está certo; popup = só o `override.crt` faltando no PC.
- **Cert-mãe:** `C:\Users\Usuario\medellin-bar-keys\` (par cert+chave que CASA, CN=Medellin Music Bar, O=Impulso Digital, val. 2036). Cert público = `override.crt` (raiz + `public/` + embutido no `installer/comandapro-impressao.ps1`, os 3 idênticos byte-a-byte).
- **Instalador 1 clique (pronto):** `installer/` (`INSTALAR-IMPRESSAO.bat` + `comandapro-impressao.ps1` + `CHECKLIST-IMPRESSAO.md`). Instala QZ x86_64 silencioso, dropa o `override.crt`, auto-start, porta TMUSB001.
- **Distribuição publicada (07/07):** cliente baixa **https://comandapro.net.br/ComandaPRO-Impressao.zip** (`public/ComandaPRO-Impressao.zip`) → extrai → roda o `.bat` como Admin. Re-empacotar = `Compress-Archive` dos 3 arquivos de `installer/` → `public/`, push na `main`, **conferir URL 200 antes de mandar**.
- **Bar de 1 impressora dispensa QZ:** Chrome `--kiosk-printing` + impressora padrão imprime silencioso. QZ só é preciso pra ROTEAR (cozinha ≠ balcão).
- **Aberto (só o campo fecha):** teste em PC real com impressora imprimindo SEM popup (prova-na-fonte de hardware).
- **Doc completo:** `COMANDAPRO-IMPRESSAO-QZ.md` · memória `reference_impressao_termica_qz_tray`.

---

## Outros docs de referência (ler só o que a tarefa pedir)
- `STARTEQ-DEV-STATUS.md` — handoff do tenant Starteq (LER primeiro se mexer em Starteq).
- `DESIGN.md` — padrão visual · `PADRAO-IMPRESSAO-COMANDAPRO.md` — cupom · `PDV-PLAN.md` — roadmap PDV.
- `COMANDAPRO-SAAS-BLUEPRINT.md` — arquitetura multi-tenant · `COMANDAPRO-INTEGRACAO-SITE.md` — site headless.
