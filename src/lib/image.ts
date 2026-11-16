/** Obergrenze des Buckets (siehe Migration: file_size_limit). */
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 1600;
const QUALITIES = [0.86, 0.75, 0.6];

export class ScreenshotError extends Error {}

/**
 * Bereitet einen Screenshot fuer den Upload auf: auf hoechstens 1600 px Kantenlaenge
 * verkleinert und als WebP kodiert. So bleiben auch grosse Handyfotos unter 2 MB und die
 * Galerie laedt schnell. Scheitert das Kodieren (alter Browser), wird das Original genommen,
 * sofern es klein genug und ein erlaubtes Format ist.
 */
export async function prepareScreenshot(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new ScreenshotError("Bitte wähle ein Bild (PNG, JPG oder WebP).");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ScreenshotError("Dieses Bild lässt sich nicht öffnen. Versuch PNG oder JPG.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback(file);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    // Manche Browser liefern statt WebP stillschweigend PNG: dann lieber das Original pruefen.
    if (!blob || blob.type !== "image/webp") return fallback(file);
    if (blob.size <= MAX_SCREENSHOT_BYTES) return blob;
  }
  throw new ScreenshotError("Das Bild ist zu groß. Bitte schneide es zu oder nimm ein kleineres.");
}

function fallback(file: File): Blob {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new ScreenshotError("Bitte wähle ein PNG, JPG oder WebP.");
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    throw new ScreenshotError("Das Bild ist größer als 2 MB.");
  }
  return file;
}

export function extensionFor(type: string): string {
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
}
