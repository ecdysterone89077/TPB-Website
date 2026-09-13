import { useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@tpb/contracts";
import { api } from "../../lib/api";

type Entry = { group: string; title: string; text: string; href: string };

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function buildIndex(content: SiteContent): Entry[] {
  const out: Entry[] = [];
  const navLabel = (hrefs: string[], fallback: string) =>
    content.navigation.find((n) => hrefs.includes(n.href))?.label ?? fallback;
  const G_HOME = navLabel(["/"], "Beranda");
  const G_PROFIL = navLabel(["/#profil"], "Profil");
  const G_AKADEMIK = navLabel(["/#akademik"], "Akademik");
  const G_PENELITIAN = navLabel(["/#penelitian"], "Penelitian");
  const G_PENGABDIAN = navLabel(["/#pengabdian"], "Pengabdian");
  const G_KEMAHASISWAAN = navLabel(["/#kemahasiswaan"], "Kemahasiswaan");
  const G_KONTAK = content.footer.infoTitle || "Kontak";
  const push = (group: string, title: string, parts: unknown[], href: string) => {
    const text = parts.filter(has).join(" ").slice(0, 220);
    if (!title.trim() && !text) return;
    out.push({ group, title: title.trim() || text.slice(0, 60), text, href });
  };
  const h = content.hero;
  push(G_HOME, "Selamat Datang", [h.badge, h.line1, h.highlight, h.line2, h.subtitle], "/#top");
  const a = content.about;
  push(G_PROFIL, a.title, [a.kicker, a.title, a.body, ...a.points], "/#profil");
  for (const card of content.programs.cards)
    push(G_AKADEMIK, card.title, [card.tag, card.title, card.body], "/#akademik");
  for (const area of content.research.areas)
    push(G_PENELITIAN, area.title, [area.no, area.title, area.body], "/#penelitian");
  for (const m of content.research.metrics) push(G_PENELITIAN, m.l, [m.v, m.l], "/#penelitian");
  const cm = content.community;
  push(G_PENGABDIAN, cm.title, [cm.kicker, cm.title, cm.body, ...cm.items], "/#pengabdian");
  for (const card of content.studentLife.cards)
    push(G_KEMAHASISWAAN, card.title, [card.tag, card.title, card.body], "/#kemahasiswaan");
  const p = content.profil;
  for (const t of p.sejarah.timeline) push(G_PROFIL, "Sejarah " + t.year, [t.year, t.text], "/#sejarah");
  push(G_PROFIL, "Visi & Misi", [p.visiMisi.visi, ...p.visiMisi.misi], "/#visi-misi");
  for (const person of p.struktur.people)
    push(G_PROFIL, person.name, [person.role, person.name], "/#struktur");
  push(G_PROFIL, "Sambutan Kaprodi", [p.sambutan.quote, p.sambutan.name], "/#sambutan");
  push(G_AKADEMIK, content.akademik.kurikulum.title, [content.akademik.kurikulum.intro, ...content.akademik.kurikulum.clusters], "/#kurikulum");
  for (const item of content.akademik.kalender.items)
    push(G_AKADEMIK, item.e, [item.d, item.e], "/#kalender");
  for (const d of content.akademik.dosen.people)
    push(G_AKADEMIK, d.name, [d.field, ...(d.details ?? [])], "/#dosen");
  for (const lab of content.akademik.laboratorium.labs)
    push(G_AKADEMIK, lab.name, [lab.name, lab.desc], "/#laboratorium");
  for (const pub of content.penelitian.publikasi.pubs)
    push(G_PENELITIAN, pub.title, [pub.title, pub.venue, pub.year], "/#publikasi");
  for (const partner of content.penelitian.kolaborasi.partners)
    push(G_PENELITIAN, partner, [partner], "/#kolaborasi");
  for (const d of content.pengabdian.programDesa.desa)
    push(G_PENGABDIAN, d.name, [d.name, d.body], "/#program-desa");
  for (const item of content.pengabdian.kegiatan.items)
    push(G_PENGABDIAN, item.t, [item.t, item.d], "/#kegiatan");
  for (const item of content.kemahasiswaan.beasiswa.items)
    push(G_KEMAHASISWAAN, item.name, [item.name, item.body], "/#beasiswa");
  for (const item of content.kemahasiswaan.prestasi.items)
    push(G_KEMAHASISWAAN, item, [item], "/#prestasi");
  push(G_KONTAK, content.footer.contact.email, [content.footer.contact.phone, content.footer.contact.email, content.footer.contact.address], "/#kontak");
  return out;
}

export function SearchButton({ content, compact = false }: { content: SiteContent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <>
    <button
      onClick={() => setOpen(true)}
      aria-label="Cari di situs"
      className={compact
        ? "rounded-full border border-midnight/15 px-4 py-2 text-xs font-bold"
        : "rounded-full px-4 py-2.5 text-[12px] font-bold text-midnight/70 transition hover:bg-midnight/5 hover:text-midnight"}
    >🔍 Cari</button>
    {open && <SearchDialog content={content} onClose={() => setOpen(false)} />}
  </>;
}

function SearchDialog({ content, onClose }: { content: SiteContent; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<{ title: string; excerpt: string }[]>([]);
  useEffect(() => {
    let alive = true;
    api.listPublic({ limit: 50 }).then((items) => {
      if (alive) setPosts(items.map((p) => ({ title: p.title, excerpt: p.excerpt || "" })));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const base = buildIndex(content);
    const beritaGroup = content.navigation.find((n) => n.href === "/#berita")?.label ?? content.news.title ?? "Berita";
    const scored = base.map((e) => {
      const hay = `${e.title} ${e.text}`.toLowerCase();
      const score = hay.includes(q) ? (e.title.toLowerCase().includes(q) ? 0 : 1) : 2;
      return { e, score };
    }).filter((s) => s.score < 2);
    for (const p of posts) {
      const hay = `${p.title} ${p.excerpt}`.toLowerCase();
      if (hay.includes(q)) scored.push({ e: { group: beritaGroup, title: p.title, text: p.excerpt.slice(0, 220), href: "/#berita" }, score: 1 });
    }
    return scored.sort((x, y) => x.score - y.score).slice(0, 10).map((s) => s.e);
  }, [query, content, posts]);
  const go = (href: string) => { onClose(); window.location.href = href; };
  return <div className="fixed inset-0 z-[100] flex items-start justify-center bg-midnight/50 p-4 pt-24" onClick={onClose}>
    <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari program, dosen, riset, berita… (min. 2 huruf)"
        aria-label="Kata kunci pencarian"
        className="w-full border-b border-midnight/10 px-5 py-4 text-base outline-none"
      />
      <div className="max-h-80 overflow-y-auto">
        {query.trim().length >= 2 && results.length === 0 && <p className="px-5 py-6 text-sm text-midnight/55">Tidak ditemukan untuk “{query.trim()}”.</p>}
        {results.map((r, i) => <button key={`${r.href}-${r.title}-${i}`} onClick={() => go(r.href)} className="block w-full border-b border-midnight/5 px-5 py-3 text-left hover:bg-cream">
          <span className="font-mono text-[10px] uppercase tracking-wider text-leaf-600">{r.group}</span>
          <span className="block font-bold text-midnight">{r.title}</span>
          {r.text && <span className="block truncate text-xs text-midnight/55">{r.text}</span>}
        </button>)}
      </div>
    </div>
  </div>;
}
