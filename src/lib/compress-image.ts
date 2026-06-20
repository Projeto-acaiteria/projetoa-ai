"use client";
// Compressão de imagem no CLIENT antes do upload (porte validado do AgendaPRO).
// browser-image-compression usa canvas + web worker → não trava a UI e assa a orientação EXIF
// nos pixels (foto de iPhone deitada não sobe girada). Saída sempre WebP (preserva transparência
// de PNG; JPEG escureceria o fundo). HEIC do iPhone o canvas não decodifica → rejeita com mensagem.
import imageCompression from "browser-image-compression";

const HARD_INPUT_LIMIT_MB = 15;
const REJECTED_TYPES = ["image/heic", "image/heif"];

export type CompressCfg = { maxWidthOrHeight: number; maxSizeMB: number; fileType: string };
export type CompressResult =
  | { ok: true; file: File; originalKB: number; compressedKB: number }
  | { ok: false; reason: string };

// preset do cardápio: prato precisa de mais nitidez que um avatar (800px), mas não 1600.
export const MENU_PHOTO_CFG: CompressCfg = { maxWidthOrHeight: 1100, maxSizeMB: 0.35, fileType: "image/webp" };

export async function compressImage(input: File, cfg: CompressCfg = MENU_PHOTO_CFG): Promise<CompressResult> {
  if (!input.type.startsWith("image/")) return { ok: false, reason: "Envie uma imagem." };
  if (REJECTED_TYPES.includes(input.type.toLowerCase()))
    return { ok: false, reason: "Foto HEIC do iPhone não funciona aqui. Salve como JPG (ou tire um print) e envie." };
  if (input.size > HARD_INPUT_LIMIT_MB * 1024 * 1024)
    return { ok: false, reason: `Imagem muito grande. Máximo ${HARD_INPUT_LIMIT_MB}MB.` };
  try {
    const compressed = await imageCompression(input, {
      maxWidthOrHeight: cfg.maxWidthOrHeight,
      maxSizeMB: cfg.maxSizeMB,
      fileType: cfg.fileType,
      useWebWorker: true,
      initialQuality: 0.82,
    });
    const ext = (cfg.fileType || "image/webp").split("/")[1];
    const baseName = input.name.replace(/\.[^.]+$/, "") || "imagem";
    // reembrulha o Blob em File com nome+tipo coerentes (senão o contentType no Storage fica zoado)
    const file = new File([compressed], `${baseName}.${ext}`, { type: cfg.fileType });
    return { ok: true, file, originalKB: Math.round(input.size / 1024), compressedKB: Math.round(file.size / 1024) };
  } catch {
    return { ok: false, reason: "Não consegui processar a imagem. Tente outra." };
  }
}
