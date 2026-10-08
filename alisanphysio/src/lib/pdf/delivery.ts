import {
  EXPORT_COOKIE_MAX_AGE,
  EXPORT_COOKIE_PATH,
  exportCookieName,
  isExportToken,
  type ExportResult,
} from "@/lib/pdf-export-protocol";

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
 * Content-Disposition with both the plain and the RFC 5987 filename. Our
 * filenames are ASCII slugs (pdfFilename), but quotes / control characters are
 * stripped defensively so a header can never be broken by a title.
 */
export function contentDisposition(
  disposition: PdfDelivery["disposition"],
  filename: string,
): string {
  const safe = filename.replace(/["\\\r\n]/g, "").replace(/[^\x20-\x7e]/g, "_") || "document.pdf";
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
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
export function deliverPdf(buf: Buffer, filename: string, delivery: PdfDelivery): Response {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition(delivery.disposition, filename),
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
