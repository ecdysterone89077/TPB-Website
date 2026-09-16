import { useEffect, useState } from "react";
import { DriveImage } from "../DriveImage";
import type { Post, SiteContent } from "@tpb/contracts";
import { api } from "../../lib/api";
import { CollectionState, formatDate } from "./ui";
import { useSystemTexts } from "../../lib/systemTexts";

export function News({ news, anchor = "berita" }: { news: SiteContent["news"]; anchor?: string }) {
  const texts = useSystemTexts();
  const [posts, setPosts] = useState<Post[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [active, setActive] = useState<Post | null>(null); const [tab, setTab] = useState("all");
  useEffect(() => { let alive = true; api.listPublic().then((items) => alive && setPosts(items)).catch((e: Error) => alive && setError(e.message)).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, []);
  const categories = ["all", ...Array.from(new Set(posts.map((post) => post.category)))]; const shown = tab === "all" ? posts : posts.filter((post) => post.category === tab);
  return <section id={anchor} className="scroll-mt-24 bg-cream py-24"><div className="mx-auto max-w-[1360px] px-5 lg:px-10"><div className="reveal flex flex-wrap items-end justify-between gap-6"><div><span className="section-kicker kicker-rule text-leaf-600">{news.kicker}</span><h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.08] text-midnight lg:text-5xl">{news.title}</h2></div><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => setTab(category)} className={`rounded-full px-5 py-2.5 text-[13px] font-bold capitalize transition duration-300 ${tab === category ? "bg-midnight text-white" : "border border-midnight/12 text-midnight/60 hover:border-midnight/25 hover:text-midnight"}`}>{category === "all" ? texts.newsAllTab : category}</button>)}</div></div><CollectionState loading={loading} error={error} empty={!shown.length}><div className="mt-12 grid gap-7 md:grid-cols-2 lg:grid-cols-3">{shown.map((post) => <article key={post.id} onClick={() => setActive(post)} className="reveal group flex cursor-pointer flex-col overflow-hidden surface lift hover:-translate-y-1.5"><div className="relative h-52 overflow-hidden bg-midnight/10">{post.image && <DriveImage src={post.image} alt={post.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}<span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-midnight">{post.category}</span></div><div className="flex flex-1 flex-col p-6"><div className="font-mono text-[11px] uppercase tracking-wider text-midnight/45">{formatDate(post.date)} · {post.readTime}</div><h3 className="mt-3 flex-1 font-display text-xl font-bold leading-snug text-midnight">{post.title}</h3><span className="mt-5 inline-flex items-center gap-2 text-[13px] font-bold text-midnight/70">Selengkapnya <span aria-hidden className="text-gold transition duration-300 group-hover:translate-x-0.5">→</span></span></div></article>)}</div></CollectionState></div>{active && <div onClick={() => setActive(null)} className="fixed inset-0 z-[90] grid place-items-center bg-midnight/70 p-4 backdrop-blur-sm"><div onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-8"><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[11px] uppercase tracking-wider text-leaf-600">{active.category}</span><h3 className="mt-2 font-display text-3xl font-extrabold text-midnight">{active.title}</h3><p className="mt-2 text-xs text-midnight/50">{formatDate(active.date)} · {active.readTime}</p></div><button onClick={() => setActive(null)} aria-label="Tutup" className="rounded-full bg-midnight/5 px-3 py-1 text-sm font-bold text-midnight">✕</button></div>{active.image && <DriveImage src={active.image} alt={active.title} className="mt-6 max-h-72 w-full rounded-2xl object-cover" />}<p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-midnight/75">{active.content || active.excerpt}</p></div></div>}</section>;
}

export function CTA({ cta, onDaftar, anchor }: { cta: SiteContent["cta"]; onDaftar: () => void; anchor?: string }) {
  return (
    <section id={anchor} className="scroll-mt-24 bg-cream py-16 lg:py-24">
      <div className="mx-auto max-w-[1360px] px-5 lg:px-10">
        <div className="reveal relative overflow-hidden rounded-[2.5rem] border border-midnight/10 bg-gradient-to-br from-midnight via-midnight-700 to-leaf-600 px-8 py-16 text-center shadow-[0_40px_80px_-50px_rgba(14,16,68,0.9)] lg:px-20">
          <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-leaf/30 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.08] text-white lg:text-5xl">{cta.title}</h2>
          <p className="relative mx-auto mt-5 max-w-xl text-[16px] text-white/85">{cta.body}</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-4">
            <button onClick={onDaftar} className="rounded-full bg-gold px-8 py-4 text-sm font-extrabold text-midnight transition duration-300 hover:-translate-y-0.5">{cta.primary}</button>
            <a href={cta.secondaryHref} className="rounded-full border border-white/40 px-8 py-4 text-sm font-bold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/10">{cta.secondary}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
