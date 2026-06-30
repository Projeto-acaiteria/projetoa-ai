// Largura da impressão térmica (mm) — CALIBRÁVEL POR MÁQUINA (localStorage).
// O sistema se adapta à impressora, não o contrário: cada impressora/driver tem uma área
// imprimível real (576 dots / 72mm, 512 dots / 64mm, 58mm…). Em vez de exigir reconfigurar a
// impressora, o operador ajusta a largura aqui até o cupom parar de cortar — e o sistema passa a
// renderizar exatamente naquela largura (corpo do cupom + página do QZ usam o mesmo valor).
const KEY = "print:widthMm";
export const DEFAULT_PRINT_WIDTH_MM = 72;
export const PRINT_WIDTH_PRESETS = [58, 64, 72, 80];

export function getPrintWidthMm(): number {
  if (typeof window === "undefined") return DEFAULT_PRINT_WIDTH_MM;
  const v = parseFloat(localStorage.getItem(KEY) || "");
  return v >= 40 && v <= 80 ? v : DEFAULT_PRINT_WIDTH_MM;
}

export function setPrintWidthMm(mm: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(Math.max(40, Math.min(80, Math.round(mm)))));
}

/** Cupom de CALIBRAÇÃO: renderiza na largura atual, com a borda direita marcada. Se o "DIR|" ou a
 *  moldura da direita saírem cortados, é só diminuir a largura; se sobra muito espaço, aumentar. */
export function widthTestHtml(): string {
  const w = getPrintWidthMm();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    @page{margin:0}
    body{width:${w}mm;padding:2mm 4mm;font-weight:700;font-size:13px;line-height:1.35}
    .t{text-align:center;font-size:15px}
    .box{border:2px solid #000;padding:4px;text-align:center;margin:5px 0}
    .edge{display:flex;justify-content:space-between;font-size:14px}
    .fill{letter-spacing:0;word-break:break-all;border-bottom:2px solid #000}
    hr{border:none;border-top:1px dashed #000;margin:5px 0}
    .hint{font-size:11px;text-align:center}
  </style></head><body>
    <div class="t">TESTE DE LARGURA</div>
    <div class="t">${w} mm</div>
    <hr>
    <div class="box">ESTE QUADRO CABE INTEIRO?</div>
    <div class="edge"><span>|ESQ</span><span>DIR|</span></div>
    <div class="fill">${"#".repeat(60)}</div>
    <hr>
    <div class="hint">Cortou o "DIR|" ou a moldura da direita? Diminua a largura. Sobrou espaço em branco na direita? Aumente.</div>
  </body></html>`;
}
