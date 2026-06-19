// Tira screenshot de rotas do app (validação visual).
// Uso: node scripts/shot.mjs <rota> <arquivo.png> [largura] [altura]
// Ex:  node scripts/shot.mjs /admin/financeiro fin.png 1180 920
import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

// localiza o Chrome baixado pelo puppeteer no cache do usuário
function findChrome() {
  const base = path.join(homedir(), ".cache", "puppeteer", "chrome");
  if (!existsSync(base)) return null;
  for (const v of readdirSync(base)) {
    const exe = path.join(base, v, "chrome-win64", "chrome.exe");
    if (existsSync(exe)) return exe;
  }
  return null;
}

const [route = "/", out = "shot.png", w = "1180", h = "900"] = process.argv.slice(2);
const chrome = findChrome();
if (!chrome) {
  console.error("Chrome não encontrado em ~/.cache/puppeteer. Rode: npx puppeteer browsers install chrome");
  process.exit(1);
}

const br = await puppeteer.launch({ headless: true, executablePath: chrome, args: ["--no-sandbox"] });
const p = await br.newPage();
await p.setViewport({ width: +w, height: +h });
await p.goto(`http://localhost:3001${route}`, { waitUntil: "networkidle0", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: out });
console.log("ok →", out);
await br.close();
