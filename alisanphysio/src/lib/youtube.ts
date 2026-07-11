/**
 * YouTube URL helpers. Accepts the usual shapes Alişan might paste
 * (watch?v=, youtu.be/, /embed/, /shorts/, or a bare 11-char id) and produces
 * a privacy-friendly nocookie embed URL for the client player.
 */

const ID = "[A-Za-z0-9_-]{11}";
const PATTERNS = [
  new RegExp(`youtube\\.com/watch\\?(?:.*&)?v=(${ID})`),
  new RegExp(`youtu\\.be/(${ID})`),
  new RegExp(`youtube(?:-nocookie)?\\.com/embed/(${ID})`),
  new RegExp(`youtube\\.com/shorts/(${ID})`),
];

/** Extract the 11-char video id from any common YouTube URL, or null. */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.trim();
  for (const re of PATTERNS) {
    const m = s.match(re);
    if (m) return m[1];
  }
  if (new RegExp(`^${ID}$`).test(s)) return s;
  return null;
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
