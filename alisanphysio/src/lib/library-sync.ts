import { isRichTextEmpty } from "@/lib/rich-text";
import { parseYouTubeId } from "@/lib/youtube";

/**
 * Pure rules behind "Update library exercise" / "Add to library" on a
 * programme-editor row (no React, no server code, so the Node tests and the
 * editor agree on one definition of "differs").
 *
 * An exercise row copies its cues when it is added and keeps its own video
 * override, so only two things can differ from the library, and only in the
 * direction a row can push them: non-empty cues that are not the library's,
 * and a YouTube video that is not the library's.
 */

/** Which library fields an editor row would change. */
export type LibraryDiff = { cues: boolean; video: boolean };

/** The library fields an update touched (only the keys it changed). */
export type LibrarySyncValues = { default_instructions?: string | null; youtube_url?: string | null };

/** Line endings and surrounding whitespace do not count as a difference. */
const norm = (s: string | null | undefined) => (s ?? "").replace(/\r\n/g, "\n").trim();

/**
 * What a row would change in its library entry. An empty row never wipes the
 * library's cues, and a non-YouTube "Watch demo" link never goes to the
 * library: it is a per-exercise link, not a shared video.
 */
export function libraryDiff(
  row: { instructions: string | null; media_url: string | null },
  entry: { default_instructions: string | null; youtube_url: string | null },
): LibraryDiff {
  const cues = !isRichTextEmpty(row.instructions) && norm(row.instructions) !== norm(entry.default_instructions);
  const rowVideo = parseYouTubeId(row.media_url);
  const video = rowVideo !== null && rowVideo !== parseYouTubeId(entry.youtube_url);
  return { cues, video };
}

/** Whether the row has anything the library would take from it. */
export function hasLibraryDiff(diff: LibraryDiff): boolean {
  return diff.cues || diff.video;
}

/**
 * How many programmes (or saved days) show the library video through their
 * exercise: distinct owners with at least one linked row that has no YouTube
 * video of its own, so the library's video plays there.
 */
export function countShownLibraryVideo(rows: { owner: string; media_url: string | null }[]): number {
  const owners = new Set<string>();
  for (const row of rows) {
    if (parseYouTubeId(row.media_url) === null) owners.add(row.owner);
  }
  return owners.size;
}
