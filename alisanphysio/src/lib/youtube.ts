/**
 * YouTube URL helpers. Accepts the usual shapes Alişan might paste
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/, share links with ?si=, or a
 * bare 11-char id) and produces a privacy-friendly nocookie embed URL for the
 * client player.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** 11-char path words YouTube uses under /embed/ that are NOT video ids. */
const RESERVED = new Set(["videoseries", "live_stream"]);
/** youtube.com path prefixes whose next segment is the video id. */
const ID_PATHS = new Set(["shorts", "embed", "live", "v", "e"]);

function asId(s: string | null | undefined): string | null {
  return s && ID_RE.test(s) && !RESERVED.has(s) ? s : null;
}

function hostKind(hostname: string): "short" | "main" | "nocookie" | null {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "youtu.be" || h === "www.youtu.be") return "short";
  if (h === "youtube.com" || h.endsWith(".youtube.com")) return "main"; // www., m., music.
  if (h === "youtube-nocookie.com" || h.endsWith(".youtube-nocookie.com")) return "nocookie";
  return null;
}

/** Extract the 11-char video id from any common YouTube URL, or null. Only
 *  YouTube hosts count, and an id must be exactly 11 characters. */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim(); // zero-width chars
  if (!s) return null;
  if (ID_RE.test(s)) return s; // a bare id
  const direct = idFromUrl(s);
  if (direct) return direct;

  // Pasted embed code (<iframe src="…">), or a link inside other text or
  // punctuation ("Video: https://youtu.be/…", "(https://…).").
  const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(s)?.[1];
  for (const token of [src, ...s.split(/\s+/)]) {
    if (!token) continue;
    const id = idFromUrl(token.replace(/^[<(["']+/, "").replace(/[>)\]"'.,;:!?]+$/, ""));
    if (id) return id;
  }
  return null;
}

/** The video id in a single YouTube URL (scheme optional), or null. */
function idFromUrl(s: string): string | null {
  let u: URL;
  try {
    // Scheme-less pastes: "youtu.be/…", "www.youtube.com/…", "//youtube.com/…".
    u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const kind = hostKind(u.hostname);
  if (!kind) return null;

  const seg = u.pathname.split("/").filter(Boolean);
  const head = seg[0]?.toLowerCase();
  if (kind === "short") return seg.length === 1 ? asId(seg[0]) : null; // youtu.be/ID
  if (kind === "nocookie") return seg.length === 2 && head === "embed" ? asId(seg[1]) : null;
  if (head === "watch" && seg.length === 1) return asId(u.searchParams.get("v")); // watch?…&v=ID
  if (seg.length === 2 && head && ID_PATHS.has(head)) return asId(seg[1]); // shorts|embed|live|v|e/ID
  return null;
}

/**
 * The video an exercise actually shows: the exercise's own override
 * (media_url, "use a different video for this client") wins over the linked
 * library entry's video. One rule for the editor, the client view and the PDF.
 */
export function effectiveVideoId(
  overrideUrl: string | null | undefined,
  libraryUrl: string | null | undefined,
): string | null {
  return parseYouTubeId(overrideUrl) ?? parseYouTubeId(libraryUrl);
}

/** Canonical watch URL to store (or null if the input isn't a YouTube link). */
export function normalizeYouTubeUrl(input: string): string | null {
  const id = parseYouTubeId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Privacy-friendly embed URL. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** Thumbnail used for the click-to-load facade. */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * The link a client gets when an exercise's override is NOT a playable
 * YouTube video: a plain http(s) URL (e.g. Vimeo, or a legacy "demo video or
 * image" link) shown as a "Watch demo" link — but only when no YouTube video
 * plays for the exercise at all (an override or library video wins). Shared
 * by the client view and the editor so both describe the same outcome. The
 * PDF only shows playable videos.
 */
export function externalVideoUrl(
  overrideUrl: string | null | undefined,
  libraryUrl: string | null | undefined,
): string | null {
  if (effectiveVideoId(overrideUrl, libraryUrl)) return null;
  const override = overrideUrl?.trim();
  if (!override || /\s/.test(override)) return null;
  try {
    const u = new URL(override);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname ? override : null;
  } catch {
    return null;
  }
}
