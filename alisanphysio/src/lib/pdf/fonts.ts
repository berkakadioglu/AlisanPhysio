import fs from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { breakableParts } from "./pdf-text";

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

  // *italic* in coaching text needs an italic Inter face, or react-pdf throws
  // "Could not resolve font … fontStyle italic". Inter-Italic / Inter-BoldItalic
  // are used when bundled here; until then the italic slots point at the
  // upright files, so italic text renders upright instead of failing.
  const italic = (name: string, upright: string) => {
    const file = path.join(dir, name);
    return fs.existsSync(file) ? file : path.join(dir, upright);
  };

  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
      { src: italic("Inter-Italic.ttf", "Inter-Regular.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: italic("Inter-BoldItalic.ttf", "Inter-Bold.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Archivo",
    fonts: [
      { src: path.join(dir, "Archivo-Bold.ttf"), fontWeight: 700 },
      { src: path.join(dir, "Archivo-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });

  // No hyphenation — exercise names and Turkish words stay intact. Only very
  // long tokens (pasted links) get invisible break points, so they wrap
  // instead of running off the page (see breakableParts).
  Font.registerHyphenationCallback(breakableParts);
  registered = true;
}
