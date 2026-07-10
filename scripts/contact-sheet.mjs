// Monta contact sheets (grade de miniaturas rotuladas) pra QA visual do cardápio. sharp + fetch.
// Uso: node scripts/contact-sheet.mjs caminho/fotos.json pastaSaida
import { readFileSync } from "node:fs";
import sharp from "sharp";
const [jsonPath, outDir] = process.argv.slice(2);
const items = JSON.parse(readFileSync(jsonPath, "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TW = 210, IH = 180, LH = 34, TH = IH + LH, COLS = 6, PER = 36;

async function tile(it, idx) {
  let imgBuf;
  try {
    const r = await fetch(it.url.split("?")[0] + "?w=200&h=200&fit=crop");
    imgBuf = Buffer.from(await r.arrayBuffer());
    imgBuf = await sharp(imgBuf).resize(TW, IH, { fit: "cover" }).toBuffer();
  } catch {
    imgBuf = await sharp({ create: { width: TW, height: IH, channels: 3, background: "#333" } }).png().toBuffer();
  }
  const label = `#${idx}  ${it.name}`;
  const svg = Buffer.from(
    `<svg width="${TW}" height="${TH}"><rect width="${TW}" height="${TH}" fill="#111"/>` +
    `<rect y="${IH}" width="${TW}" height="${LH}" fill="#e90c0c"/>` +
    `<text x="6" y="${IH + 15}" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">${esc(label.slice(0, 30))}</text>` +
    `<text x="6" y="${IH + 29}" font-family="Arial" font-size="10" fill="#ffd">${esc(it.category.slice(0, 32))}</text></svg>`
  );
  return sharp(svg).composite([{ input: imgBuf, top: 0, left: 0 }]).png().toBuffer();
}

async function sheet(slice, startIdx, outPath) {
  const tiles = await Promise.all(slice.map((it, i) => tile(it, startIdx + i)));
  const rows = Math.ceil(tiles.length / COLS);
  const canvas = sharp({ create: { width: COLS * TW, height: rows * TH, channels: 3, background: "#000" } });
  const comp = tiles.map((buf, i) => ({ input: buf, top: Math.floor(i / COLS) * TH, left: (i % COLS) * TW }));
  await canvas.composite(comp).jpeg({ quality: 82 }).toFile(outPath);
  console.log("ok:", outPath, `(${tiles.length} tiles)`);
}

for (let s = 0; s * PER < items.length; s++) {
  const slice = items.slice(s * PER, s * PER + PER);
  await sheet(slice, s * PER, `${outDir}/sheet-${s + 1}.jpg`);
}
