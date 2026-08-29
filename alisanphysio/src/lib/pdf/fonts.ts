import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Register the brand fonts for PDF export — Inter (body) + Archivo (display),
 * both with full Turkish glyph coverage (ş ğ İ ı ç ö ü), so the document reads
 * correctly in either language. The .ttf files are bundled under this folder
 * and included in the serverless deploy via `outputFileTracingIncludes` in
 * next.config.ts. Runs once per process.
 */
let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  const dir = path.join(process.cwd(), "src", "lib", "pdf", "fonts");

  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Archivo",
    fonts: [
      { src: path.join(dir, "Archivo-Bold.ttf"), fontWeight: 700 },
      { src: path.join(dir, "Archivo-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });

  // Don't hyphenate/split words — keeps exercise names + Turkish words intact.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
