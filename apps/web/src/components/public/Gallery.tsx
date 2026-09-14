import { useCallback, useEffect, useState } from "react";
import { DriveImage } from "../DriveImage";
import type { GalleryItem } from "@tpb/contracts";
import { api } from "../../lib/api";

export const GALLERY_OPEN_EVENT = "tpb:open-gallery";

export function openGallery(index = 0) {
  window.dispatchEvent(new CustomEvent(GALLERY_OPEN_EVENT, { detail: { index } }));
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/)
    || url.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

export function instagramEmbed(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const kind = url.includes("/reel/") ? "reel" : url.includes("/tv/") ? "tv" : "p";
  return `https://www.instagram.com/${kind}/${m[1]}/embed`;
}

export function videoThumbUrl(item: GalleryItem): string | null {
  if (item.thumb) return item.thumb;
  const yt = youtubeId(item.image) || youtubeId(item.link || "");
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

function VideoThumb({ item }: { item: GalleryItem }) {
  const thumb = videoThumbUrl(item);
  if (!thumb)
    return <span className="grid h-full w-full place-items-center bg-gradient-to-br from-midnight via-leaf-600 to-midnight">
      <span className="flex flex-col items-center gap-2 px-2 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-gold text-lg text-midnight">▶</span>
      {item.title && <span className="line-clamp-2 text-[11px] font-bold text-white">{item.title}</span>}</span>
    </span>;
  return <>
    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
    <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-gold text-lg text-midnight">▶</span></span>
  </>;
}

function Viewer({ item }: { item: GalleryItem }) {
  if (item.kind === "video") {
    const id = youtubeId(item.image) || youtubeId(item.link || "");
    if (id)
      return <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={item.title || item.caption || "Video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" />
      </div>;
  }
  if (item.kind === "instagram") {
    const embed = instagramEmbed(item.image);
    if (embed)
      return <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <iframe src={embed} allowFullScreen className="h-full w-full" />
      </div>;
  }
  return <DriveImage src={item.image} alt={item.caption || item.title || ""} className="h-full w-full object-contain" />;
}

export function Gallery({ items, onOpen }: { items: GalleryItem[]; onOpen?: (idx: number) => void }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [openAt, setOpenAt] = useState<number>(0);
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.index === "number") {
        setOpenAt(e.detail.index);
        setViewerIndex(e.detail.index);
      }
    };
    window.addEventListener(GALLERY_OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(GALLERY_OPEN_EVENT, handler as EventListener);
  }, []);
  const handleOpen = (index: number) => {
    setOpenAt(index);
    setViewerIndex(index);
    onOpen?.(index);
  };
  return <>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <article key={item.id} onClick={() => handleOpen(index)} className="group overflow-hidden rounded-2xl bg-midnight/10 cursor-pointer transition hover:-translate-y-1">
          <div className="aspect-square overflow-hidden bg-midnight/5 relative">
            {item.kind === "video" ? <VideoThumb item={item} /> : <DriveImage src={item.image} alt={item.caption || item.title || ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
            {item.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-gold text-lg text-midnight">▶</span></span>}
            <span className="absolute left-2 top-2 rounded-full bg-gold/90 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-midnight">{item.category}</span>
          </div>
          <div className="p-4">
            <h4 className="font-display text-lg font-bold text-midnight line-clamp-1">{item.title}</h4>
            {item.caption && <p className="mt-1 text-sm text-midnight/55 line-clamp-2">{item.caption}</p>}
          </div>
        </article>
      ))}
    </div>
    {viewerIndex !== null && (
      <div onClick={() => setViewerIndex(null)} className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-midnight/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Galeri">
        <article onClick={(event) => event.stopPropagation()} className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <Viewer item={items[viewerIndex]} />
          <div className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-wider text-midnight/45">{items[viewerIndex].category}</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-midnight">{items[viewerIndex].title}</h3>
            {items[viewerIndex].caption && <p className="mt-3 text-sm leading-relaxed text-midnight/70">{items[viewerIndex].caption}</p>}
            <div className="mt-4 flex justify-end gap-2">
              {viewerIndex > 0 && <button onClick={() => setViewerIndex(viewerIndex - 1)} className="rounded-full bg-midnight px-5 py-2 text-sm font-bold text-white">Sebelumnya</button>}
              <button onClick={() => setViewerIndex(null)} className="rounded-full border border-midnight/15 px-5 py-2 text-sm font-bold text-midnight">Tutup</button>
              {viewerIndex < items.length - 1 && <button onClick={() => setViewerIndex(viewerIndex + 1)} className="rounded-full bg-midnight px-5 py-2 text-sm font-bold text-white">Selanjutnya</button>}
            </div>
          </div>
        </article>
      </div>
    )}
  </>;
}
