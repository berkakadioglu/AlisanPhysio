import {
  EXPORT_COOKIE_MAX_AGE,
  EXPORT_COOKIE_PATH,
  exportCookieName,
  isExportToken,
  type ExportResult,
} from "@/lib/pdf-export-protocol";
import type { PdfFileName } from "./build";

/**
 * How a GET export answers. Opened directly (a new tab, a bookmark) the PDF is
 * shown INLINE, so Safari / iPadOS show it in their PDF viewer. The "Save as
 * PDF" button asks for `?download=1` (an attachment) plus a `token`, and then
 * reads the outcome from a cookie — see src/lib/pdf-export-protocol.ts.
 */
export interface PdfDelivery {
  disposition: "inline" | "attachment";
  /** Present only for the button's navigations. */
  token: string | null;
  /** Mark the result cookie Secure on https (production). */
  secure: boolean;
}

export function pdfDelivery(url: URL): PdfDelivery {
  const token = url.searchParams.get("token");
  return {
    disposition: url.searchParams.get("download") === "1" ? "attachment" : "inline",
    token: isExportToken(token) ? token : null,
    secure: url.protocol === "https:",
  };
}

/**
 * RFC 5987 value encoding. encodeURIComponent leaves ' ( ) * alone, and those
 * are not attr-chars, so they are percent-encoded here as well.
 */
export function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Content-Disposition with both filenames. `filename` is the ASCII fallback
 * (quotes, control characters and non-ASCII are replaced, so a title can never
 * break the header), and `filename*` carries the real UTF-8 name, RFC 5987
 * encoded, so a Turkish title reaches the file name intact. A plain string is
 * used for both; a plain ASCII slug gives the same header as before.
 */
export function contentDisposition(
  disposition: PdfDelivery["disposition"],
  name: string | PdfFileName,
): string {
  const ascii = typeof name === "string" ? name : name.ascii;
  const unicode = typeof name === "string" ? name : name.unicode;
  const safe = ascii.replace(/["\\\r\n]/g, "").replace(/[^\x20-\x7e]/g, "_") || "document.pdf";
  const full = unicode.replace(/[\u0000-\u001f\u007f"\\/]/g, "").trim() || safe;
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encodeRfc5987(full)}`;
}

function resultCookie(delivery: PdfDelivery, result: ExportResult): string | null {
  if (!delivery.token) return null;
  return [
    `${exportCookieName(delivery.token)}=${result}`,
    `Path=${EXPORT_COOKIE_PATH}`,
    `Max-Age=${EXPORT_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    ...(delivery.secure ? ["Secure"] : []),
  ].join("; ");
}

/** The PDF itself, with its filename and (for the button) the "ok" cookie. */
export function deliverPdf(buf: Buffer, name: string | PdfFileName, delivery: PdfDelivery): Response {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition(delivery.disposition, name),
    "Content-Length": String(buf.byteLength),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const cookie = resultCookie(delivery, "ok");
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(new Uint8Array(buf), { headers });
}

/**
 * A failed export. For the button's navigation: an empty 204 — the browser
 * stays on the current page — plus the "fail" cookie, so the button shows its
 * red error toast. Opened directly: the usual status and a short message.
 */
export function deliveryFailure(delivery: PdfDelivery, status: number, message: string): Response {
  const cookie = resultCookie(delivery, "fail");
  if (!cookie) return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" },
  });
}
