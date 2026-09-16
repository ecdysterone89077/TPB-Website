import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { Block } from "@tpb/contracts";
import { DriveImage } from "../DriveImage";

type GalleryBlockSchemaType = Extract<Block, { type: "gallery" }>["data"];
import { Hero, Marquee } from "./Hero";
import { RichTextView } from "./RichText";
import { instagramEmbed, youtubeId } from "./Gallery";

const HeavyBlockView = lazy(() => import("./HeavyBlocks"));

type Dafter = () => void;

function HeadingView({ block }: { block: Extract<Block, { type: "heading" }> }) {
  const { text, level, align } = block.data;
  const cls = `font-display font-extrabold text-midnight ${align === "center" ? "text-center" : ""} ${level === 2 ? "text-4xl lg:text-5xl" : level === 3 ? "text-3xl" : "text-2xl"}`;
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-12 lg:py-16">
      <div className="mx-auto max-w-[1360px] px-5 lg:px-10">
        {level === 2 && <span aria-hidden className="mb-5 block h-[3px] w-12 rounded-full bg-gold" />}
        {level === 2 ? <h2 className={cls}>{text}</h2> : level === 3 ? <h3 className={cls}>{text}</h3> : <h4 className={cls}>{text}</h4>}
      </div>
    </section>
  );
}

function ImageView({ block }: { block: Extract<Block, { type: "image" }> }) {
  const { image, alt, caption, link } = block.data;
  const inner = image ? <DriveImage src={image} alt={alt} className="mx-auto max-h-[560px] w-full rounded-3xl object-cover" /> : null;
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-10">
      <figure className="mx-auto max-w-[1100px] px-5 lg:px-10">
        {link ? <a href={link} target="_blank" rel="noopener noreferrer">{inner}</a> : inner}
        {caption && <figcaption className="mt-4 text-center text-sm text-midnight/55">{caption}</figcaption>}
      </figure>
    </section>
  );
}

function VideoView({ block }: { block: Extract<Block, { type: "video" }> }) {
  const { url, mode, thumb, caption } = block.data;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  if (!url) return null;
  const yt = youtubeId(url);
  const ig = instagramEmbed(url);
  const preview = thumb || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : "");
  const player = yt ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`} title="Video" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : ig ? <iframe src={ig} title="Video" className="h-full w-full" allowFullScreen /> : <video src={url} controls autoPlay className="h-full w-full" />;
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-10">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-10">
        {mode === "popup" ? (
          <button onClick={() => setOpen(true)} className="group relative block w-full overflow-hidden rounded-3xl bg-midnight" aria-label="Putar video">
            {preview ? <DriveImage src={preview} alt={caption} className="h-full max-h-[560px] w-full object-cover opacity-80 transition group-hover:opacity-60" /> : <div className="grid h-72 place-items-center text-white/70">Video</div>}
            <span className="absolute inset-0 grid place-items-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-gold text-3xl text-midnight shadow-xl">▶</span></span>
          </button>
        ) : (
          <div className="aspect-video overflow-hidden rounded-3xl bg-midnight">{player}</div>
        )}
        {caption && <p className="mt-4 text-center text-sm text-midnight/55">{caption}</p>}
      </div>
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-[95] grid place-items-center bg-midnight/85 p-4 backdrop-blur-sm"><div onClick={(event) => event.stopPropagation()} className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black">{player}</div><button onClick={() => setOpen(false)} aria-label="Tutup" className="absolute right-6 top-6 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">✕</button></div>}
    </section>
  );
}

function ButtonView({ block }: { block: Extract<Block, { type: "button" }> }) {
  const { label, href, style, openInNewTab, align } = block.data;
  const styles = { primary: "bg-midnight text-white hover:bg-midnight-700", secondary: "border border-midnight/20 bg-white text-midnight hover:bg-cream", gold: "bg-gold text-midnight hover:bg-gold-600" };
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-8">
      <div className={`mx-auto flex max-w-[1360px] px-5 lg:px-10 ${align === "center" ? "justify-center" : "justify-start"}`}>
        <a href={href} {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`rounded-full px-8 py-4 text-sm font-extrabold transition ${styles[style]}`}>{label}</a>
      </div>
    </section>
  );
}

function AccordionView({ block }: { block: Extract<Block, { type: "accordion" }> }) {
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-10">
      <div className="mx-auto max-w-[900px] space-y-3 px-5 lg:px-10">
        {block.data.items.map((item) => (
          <details key={item.title} className="group rounded-2xl border border-midnight/10 bg-white p-5">
            <summary className="cursor-pointer font-display text-lg font-bold text-midnight marker:content-none">{item.title}</summary>
            {item.body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-midnight/70">{item.body}</p>}
          </details>
        ))}
      </div>
    </section>
  );
}

function TableView({ block }: { block: Extract<Block, { type: "table" }> }) {
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-10">
      <div className="mx-auto max-w-[1100px] overflow-x-auto px-5 lg:px-10">
        <table className="w-full border-collapse overflow-hidden rounded-2xl text-left text-sm">
          <thead className="bg-midnight text-white"><tr>{block.data.headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr></thead>
          <tbody>{block.data.rows.map((row, index) => <tr key={index} className="odd:bg-white even:bg-cream">{row.map((cell, cellIndex) => <td key={cellIndex} className="border-t border-midnight/10 px-4 py-3 text-midnight/75">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function EmbedView({ block }: { block: Extract<Block, { type: "embed" }> }) {
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-10">
        <iframe src={block.data.url} title={block.data.title || "Peta"} style={{ height: block.data.height }} className="map-frame" loading="lazy" />
      </div>
    </section>
  );
}

function DocLinkView({ block }: { block: Extract<Block, { type: "docLink" }> }) {
  const { kicker, title, note, links } = block.data;
  return (
    <section id={block.anchor} className="scroll-mt-24 bg-cream py-16">
      <div className="mx-auto max-w-[1360px] px-5 lg:px-10">
        <div className="reveal max-w-3xl">
          {kicker && <span className="section-kicker kicker-rule text-leaf-600">{kicker}</span>}
          {title && <h2 className="mt-4 font-display text-3xl font-extrabold leading-[1.08] text-midnight lg:text-[2.4rem]">{title}</h2>}
          {note && <p className="mt-5 text-[15px] leading-relaxed text-midnight/70">{note}</p>}
        </div>
        <ul className={`mt-10 grid gap-3 ${links.length > 5 ? "md:grid-cols-2" : ""}`}>
          {links.map((item, index) => {
            const external = /^https?:\/\//i.test(item.href);
            return (
              <li key={`${item.label}-${item.href}-${index}`}>
                <a
                  href={item.href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="reveal card card-hover group flex items-center justify-between gap-4 p-5 text-midnight"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-display text-lg font-bold">
                      {item.label}
                      {external && <span className="sr-only"> (buka di tab baru)</span>}
                    </span>
                    {item.note && <span className="mt-1 block break-words text-sm text-midnight/60">{item.note}</span>}
                  </span>
                  <span aria-hidden className="link-arrow">{external ? "↗" : "→"}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function GalleryView({ block }: { block: Extract<Block, { type: "gallery" }> }) {
  const { items, columns } = block.data as GalleryBlockSchemaType;
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowRight") setIndex((i) => (i === null ? i : (i + 1) % items.length));
      if (event.key === "ArrowLeft") setIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [index, items.length]);
  const cols = columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  const active = index === null ? null : items[index];
  const yt = active ? youtubeId(active.image) : null;
  const ig = active ? instagramEmbed(active.image) : null;
  return (
    <section id={block.anchor ?? "galeri"} className="scroll-mt-24 bg-cream py-16 lg:py-24">
      <div className="mx-auto max-w-[1360px] px-5 lg:px-10">
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`}>
          {items.map((item, i) => (
            <button key={`${item.image}-${i}`} onClick={() => setIndex(i)} className="group tile aspect-[4/3]" aria-label={item.title || item.caption || "Buka media"}>
              {item.thumb || (youtubeId(item.image) ? `https://i.ytimg.com/vi/${youtubeId(item.image)}/hqdefault.jpg` : null)
                ? <DriveImage src={item.thumb || `https://i.ytimg.com/vi/${youtubeId(item.image)}/hqdefault.jpg`} alt={item.title || item.caption || ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                : <DriveImage src={item.image} alt={item.title || item.caption || ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
              {item.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-gold/90 text-xl text-midnight">▶</span></span>}
              {(item.title || item.caption) && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-midnight/90 via-midnight/45 to-transparent p-4 pt-12 text-left">
                  {item.title && <span className="block font-display text-lg font-bold leading-snug text-white">{item.title}</span>}
                  {item.caption && <span className="mt-1 block text-xs leading-snug text-white/75">{item.caption}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div onClick={() => setIndex(null)} className="fixed inset-0 z-[95] grid place-items-center bg-midnight/85 p-4 backdrop-blur-sm">
          <div onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-black">
            {active.kind === "video" && (yt || ig) ? (
              <div className="aspect-video">{yt ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`} title="Video" className="h-full w-full" allow="autoplay; encrypted-media" allowFullScreen /> : <iframe src={ig!} title="Video" className="h-full w-full" allowFullScreen />}</div>
            ) : (
              <DriveImage src={active.image} alt={active.title || active.caption || ""} className="max-h-[80vh] w-full object-contain" />
            )}
          </div>
          {(active.title || active.caption) && <p className="mt-4 max-w-2xl text-center text-sm text-white/85">{active.title}{active.title && active.caption ? " · " : ""}{active.caption}</p>}
          <button onClick={() => setIndex(null)} aria-label="Tutup" className="absolute right-6 top-6 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">✕</button>
          {items.length > 1 && <>
            <button onClick={(event) => { event.stopPropagation(); setIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length)); }} aria-label="Sebelumnya" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white">‹</button>
            <button onClick={(event) => { event.stopPropagation(); setIndex((i) => (i === null ? i : (i + 1) % items.length)); }} aria-label="Berikutnya" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white">›</button>
          </>}
        </div>
      )}
    </section>
  );
}

export function BlockRenderer({ block, onDaftar }: { block: Block; onDaftar: Dafter }): ReactNode {
  switch (block.type) {
    case "heading": return <HeadingView block={block} />;
    case "richText": return <section id={block.anchor} className="scroll-mt-24 bg-cream py-12 lg:py-16"><div className="mx-auto max-w-[900px] px-5 lg:px-10"><RichTextView doc={block.data.doc} /></div></section>;
    case "image": return <ImageView block={block} />;
    case "video": return <VideoView block={block} />;
    case "button": return <ButtonView block={block} />;
    case "divider": return <div id={block.anchor} className="mx-auto max-w-[1100px] scroll-mt-24 px-5 lg:px-10"><hr className="border-midnight/10" /></div>;
    case "spacer": return <div id={block.anchor} className={`scroll-mt-24 ${block.data.size === "sm" ? "h-6" : block.data.size === "lg" ? "h-24" : "h-12"}`} aria-hidden />;
    case "accordion": return <AccordionView block={block} />;
    case "table": return <TableView block={block} />;
    case "embed": return <EmbedView block={block} />;
    case "gallery": return <GalleryView block={block} />;
    case "html": return <section id={block.anchor} className="scroll-mt-24 bg-cream py-10"><div className="rich-text mx-auto max-w-[900px] px-5 lg:px-10" dangerouslySetInnerHTML={{ __html: block.data.code }} /></section>;
    case "docLink": return <DocLinkView block={block} />;
    case "hero": return <Hero hero={block.data} onDaftar={onDaftar} anchor={block.anchor} />;
    case "marquee": return <Marquee items={block.data} anchor={block.anchor} />;
    case "stats":
    case "about":
    case "programs":
    case "research":
    case "community":
    case "studentLife":
    case "timeline":
    case "visiMisi":
    case "struktur":
    case "quote":
    case "kurikulum":
    case "kalender":
    case "dosen":
    case "laboratorium":
    case "publikasi":
    case "jurnal":
    case "kolaborasi":
    case "programDesa":
    case "kemitraan":
    case "kegiatan":
    case "himpunan":
    case "beasiswa":
    case "prestasi":
    case "alumni":
    case "news":
    case "cta":
      return <Suspense fallback={<div className="min-h-[240px] bg-cream" />}><HeavyBlockView block={block} onDaftar={onDaftar} /></Suspense>;
    default: return null;
  }
}
