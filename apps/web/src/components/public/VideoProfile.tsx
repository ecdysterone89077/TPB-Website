import { useEffect, useState } from "react";
import type { SiteContent } from "@tpb/contracts";
import { Band } from "./ui";

type Video = NonNullable<SiteContent["video"]>;

export function VideoProfile({ video }: { video: Video | undefined }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPlaying(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [playing]);
  if (!video || !video.youtubeId) return null;
  const thumb = `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`;
  return <>
    <Band id="video" kicker={video.kicker} title={video.title} intro={video.subtitle}>
      <button onClick={() => setPlaying(true)} aria-label={`Putar ${video.title}`} className="reveal group relative block w-full overflow-hidden rounded-[2rem]">
        <img src={thumb} alt="" className="aspect-video w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
        <span className="absolute inset-0 grid place-items-center bg-midnight/35 transition group-hover:bg-midnight/25">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gold text-2xl text-midnight shadow-xl transition group-hover:scale-110">▶</span>
        </span>
      </button>
    </Band>
    {playing && <div className="fixed inset-0 z-[100] grid place-items-center bg-midnight/80 p-4" onClick={() => setPlaying(false)}>
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setPlaying(false)} aria-label="Tutup video" className="absolute -top-12 right-0 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">✕ Tutup</button>
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
    </div>}
  </>;
}
