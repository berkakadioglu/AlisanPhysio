"use client";

import { useState } from "react";
import { youtubeEmbedUrl, youtubeThumb } from "@/lib/youtube";

/**
 * Responsive 16:9 YouTube player with a click-to-load facade: we show the
 * lightweight thumbnail and only load the (privacy-friendly nocookie) iframe
 * once the viewer taps play, so the page stays fast. Used on the client
 * program page and in the admin library preview.
 */
export default function YouTubeEmbed({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [play, setPlay] = useState(false);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
      {play ? (
        <iframe
          src={`${youtubeEmbedUrl(id)}?autoplay=1&rel=0`}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label={`Play ${title} demo`}
          className="group relative block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumb(id)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="ml-0.5 h-6 w-6 text-brand-solid"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
