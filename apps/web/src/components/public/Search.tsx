import { useEffect, useMemo, useState } from "react";
import type { Block, NavItemInput } from "@tpb/contracts";
import { api } from "../../lib/api";
import { navigate } from "../../lib/router";

type Entry = { group: string; title: string; text: string; href: string };

const flattenStrings = (value: unknown, out: string[] = [], depth = 0): string[] => {
  if (depth > 6 || value == null) return out;
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) flattenStrings(item, out, depth + 1);
  }
  return out;
};

export function buildBlockIndex(blocks: Block[], navigation: NavItemInput[]): Entry[] {
  const labelFor = (anchor?: string) => {
    const flat: NavItemInput[] = [];
    const walk = (items: NavItemInput[]) => { for (const item of items) { flat.push(item); walk(item.children ?? []); } };
    walk(navigation);
    if (!anchor) return "Halaman";
    return flat.find((n) => n.href.includes(`#${anchor}`))?.label ?? anchor.replace(/-/g, " ");
  };
  return blocks
    .filter((block) => block.isVisible !== false)
    .map((block) => {
      const parts = flattenStrings(block.data).slice(0, 30);
      return {
        group: labelFor(block.anchor),
        title: parts[0] ?? block.type,
        text: parts.join(" ").slice(0, 220),
        href: block.anchor ? `#${block.anchor}` : "#top",
      };
    })
    .filter((entry) => entry.text.length > 0);
}

export function SearchButton({ blocks, navigation, compact = false }: { blocks: Block[]; navigation: NavItemInput[]; compact?: boolean }) {
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
    {open && <SearchDialog blocks={blocks} navigation={navigation} onClose={() => setOpen(false)} />}
  </>;
}

function SearchDialog({ blocks, navigation, onClose }: { blocks: Block[]; navigation: NavItemInput[]; onClose: () => void }) {
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
    const base = buildBlockIndex(blocks, navigation);
    const scored = base.map((e) => {
      const hay = `${e.title} ${e.text}`.toLowerCase();
      const score = hay.includes(q) ? (e.title.toLowerCase().includes(q) ? 0 : 1) : 2;
      return { e, score };
    }).filter((s) => s.score < 2);
    for (const p of posts) {
      const hay = `${p.title} ${p.excerpt}`.toLowerCase();
      if (hay.includes(q)) scored.push({ e: { group: "Berita", title: p.title, text: p.excerpt.slice(0, 220), href: "#berita" }, score: 1 });
    }
    return scored.sort((x, y) => x.score - y.score).slice(0, 10).map((s) => s.e);
  }, [query, blocks, navigation, posts]);
  const go = (href: string) => { onClose(); navigate(href); };
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
