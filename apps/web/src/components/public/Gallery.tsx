import { useCallback, useEffect, useState } from "react";
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

function VideoThumb({ item }: { item: GalleryItem }) {
  const yt = youtubeId(item.image) || youtubeId(item.link || "");
  const src = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : item.image;
  return <>
    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
    const ig = instagramEmbed(item.image) || instagramEmbed(item.link || "");
    if (ig)
      return <div className="mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl bg-black">
        <iframe src={ig} title={item.title || item.caption || "Instagram"} allowTransparency allow="encrypted-media" className="h-full w-full border-0" />
      </div>;
  }
  return <img src={item.image} alt={item.caption || item.title || ""} className="max-h-[75vh] w-full rounded-2xl object-contain bg-black" />;
}

export function GalleryHost() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"grid" | "view">("grid");
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { index?: number } | undefined;
      try {
        const r = await api.listGallery({ limit: 100 });
        setItems(r.gallery);
        setIndex(Math.min(detail?.index ?? 0, Math.max(0, r.gallery.length - 1)));
        setMode("grid");
        setOpen(true);
      } catch { setItems([]); }
    };
    window.addEventListener(GALLERY_OPEN_EVENT, handler);
    return () => window.removeEventListener(GALLERY_OPEN_EVENT, handler);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") { setMode("view"); setIndex((i) => (i + 1) % items.length); }
      if (e.key === "ArrowLeft") { setMode("view"); setIndex((i) => (i - 1 + items.length) % items.length); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, items.length]);
  if (!open) return null;
  const current = items[index];
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-midnight/85 p-4" onClick={close}>
    <div className="mx-auto w-full max-w-4xl py-8" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-white">Galeri</h2>
        <button onClick={close} aria-label="Tutup galeri" className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">✕ Tutup</button>
      </div>
      {items.length === 0 && <p className="rounded-2xl bg-white/10 p-8 text-center text-sm text-white/70">Belum ada item galeri.</p>}
      {mode === "grid" && items.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, i) => <button key={item.id} onClick={() => { setIndex(i); setMode("view"); }} className="group relative aspect-square overflow-hidden rounded-xl bg-white/10" aria-label={item.title || item.caption || `Item ${i + 1}`}>
          {item.kind === "video" ? <VideoThumb item={item} /> : <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
          {item.title && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[11px] font-bold text-white">{item.title}</span>}
        </button>)}
      </div>}
      {mode === "view" && current && <div>
        <Viewer item={current} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/80">
            {current.title && <p className="font-bold text-white">{current.title}</p>}
            {current.caption && <p className="text-white/70">{current.caption}</p>}
            <p className="mt-1 text-xs text-white/50">{index + 1} / {items.length}</p>
          </div>
          <div className="flex gap-2">
            {current.link && <a href={current.link} target="_blank" rel="noreferrer" className="rounded-full bg-gold px-4 py-2 text-xs font-extrabold text-midnight">Buka tautan ↗</a>}
            <button onClick={() => setMode("grid")} className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25">Semua</button>
            <button onClick={() => setIndex((index - 1 + items.length) % items.length)} aria-label="Sebelumnya" className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25">←</button>
            <button onClick={() => setIndex((index + 1) % items.length)} aria-label="Berikutnya" className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25">→</button>
          </div>
        </div>
      </div>}
    </div>
  </div>;
}
