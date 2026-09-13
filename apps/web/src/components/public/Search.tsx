import { useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@tpb/contracts";
import { api } from "../../lib/api";

type Entry = { group: string; title: string; text: string; href: string };

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function buildIndex(content: SiteContent): Entry[] {
  const out: Entry[] = [];
  const push = (group: string, title: string, parts: unknown[], href: string) => {
    const text = parts.filter(has).join(" ").slice(0, 220);
    if (!title.trim() && !text) return;
    out.push({ group, title: title.trim() || text.slice(0, 60), text, href });
  };
  const h = content.hero;
  push("Beranda", "Selamat Datang", [h.badge, h.line1, h.highlight, h.line2, h.subtitle], "/#top");
  const a = content.about;
  push("Profil", a.title, [a.kicker, a.title, a.body, ...a.points], "/#profil");
  for (const card of content.programs.cards)
    push("Akademik", card.title, [card.tag, card.title, card.body], "/#akademik");
  for (const area of content.research.areas)
    push("Penelitian", area.title, [area.no, area.title, area.body], "/#penelitian");
  for (const m of content.research.metrics) push("Penelitian", m.l, [m.v, m.l], "/#penelitian");
  const cm = content.community;
  push("Pengabdian", cm.title, [cm.kicker, cm.title, cm.body, ...cm.items], "/#pengabdian");
  for (const card of content.studentLife.cards)
    push("Kemahasiswaan", card.title, [card.tag, card.title, card.body], "/#kemahasiswaan");
  const p = content.profil;
  for (const t of p.sejarah.timeline) push("Profil", "Sejarah " + t.year, [t.year, t.text], "/#sejarah");
  push("Profil", "Visi & Misi", [p.visiMisi.visi, ...p.visiMisi.misi], "/#visi-misi");
  for (const person of p.struktur.people)
    push("Profil", person.name, [person.role, person.name], "/#struktur");
  push("Profil", "Sambutan Kaprodi", [p.sambutan.quote, p.sambutan.name], "/#sambutan");
  push("Akademik", content.akademik.kurikulum.title, [content.akademik.kurikulum.intro, ...content.akademik.kurikulum.clusters], "/#kurikulum");
  for (const item of content.akademik.kalender.items)
    push("Akademik", item.e, [item.d, item.e], "/#kalender");
  for (const d of content.akademik.dosen.people)
    push("Akademik", d.name, [d.field, ...(d.details ?? [])], "/#dosen");
  for (const lab of content.akademik.laboratorium.labs)
    push("Akademik", lab.name, [lab.name, lab.desc], "/#laboratorium");
  for (const pub of content.penelitian.publikasi.pubs)
    push("Penelitian", pub.title, [pub.title, pub.venue, pub.year], "/#publikasi");
  for (const partner of content.penelitian.kolaborasi.partners)
    push("Penelitian", partner, [partner], "/#kolaborasi");
  for (const d of content.pengabdian.programDesa.desa)
    push("Pengabdian", d.name, [d.name, d.body], "/#program-desa");
  for (const item of content.pengabdian.kegiatan.items)
    push("Pengabdian", item.t, [item.t, item.d], "/#kegiatan");
  for (const item of content.kemahasiswaan.beasiswa.items)
    push("Kemahasiswaan", item.name, [item.name, item.body], "/#beasiswa");
  for (const item of content.kemahasiswaan.prestasi.items)
    push("Kemahasiswaan", item, [item], "/#prestasi");
  push("Kontak", content.footer.contact.email, [content.footer.contact.phone, content.footer.contact.email, content.footer.contact.address], "/#kontak");
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
    const scored = base.map((e) => {
      const hay = `${e.title} ${e.text}`.toLowerCase();
      const score = hay.includes(q) ? (e.title.toLowerCase().includes(q) ? 0 : 1) : 2;
      return { e, score };
    }).filter((s) => s.score < 2);
    for (const p of posts) {
      const hay = `${p.title} ${p.excerpt}`.toLowerCase();
      if (hay.includes(q)) scored.push({ e: { group: "Berita", title: p.title, text: p.excerpt.slice(0, 220), href: "/#berita" }, score: 1 });
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
