import { lazy, Suspense, useEffect, useState } from "react";
import type { PublicPage } from "@tpb/contracts";
import { Pmb } from "./components/Pmb";
import { BlockRenderer } from "./components/public/Blocks";
import { BackToTop, Footer } from "./components/public/ContentSections";
import { Header } from "./components/public/Hero";
import { useReveal } from "./components/public/ui";
import { api } from "./lib/api";
import { scrollToHash, slugFromPath, useAdminRoute, usePathname } from "./lib/router";
import { SiteProvider, useSite } from "./lib/site";

const AdminPage = lazy(() => import("./components/AdminPage").then((module) => ({ default: module.AdminPage })));

export default function App() {
  const admin = useAdminRoute();
  if (admin) {
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-100 text-slate-500">Memuat panel admin…</div>}>
        <AdminPage />
      </Suspense>
    );
  }
  return (
    <SiteProvider>
      <PublicApp />
    </SiteProvider>
  );
}

function Screen({ title, message, action }: { title: string; message: string; action?: { label: string; href: string } }) {
  return (
    <div className="grid min-h-screen place-items-center bg-cream p-6">
      <div className="max-w-md text-center">
        <p className="font-display text-3xl font-bold text-midnight">{title}</p>
        <p className="mt-3 text-sm text-midnight/60">{message}</p>
        {action && <a href={action.href} className="mt-5 inline-block rounded-full bg-midnight px-6 py-3 text-sm font-bold text-white">{action.label}</a>}
      </div>
    </div>
  );
}

function PublicApp() {
  const site = useSite();
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const [page, setPage] = useState<PublicPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [pmb, setPmb] = useState(false);
  useReveal();

  useEffect(() => {
    let alive = true;
    setState("loading");
    window.scrollTo({ top: 0 });
    api.getPage(slug)
      .then((result) => {
        if (!alive) return;
        if (!result) {
          setPage(null);
          setState("notfound");
          document.title = "Halaman tidak ditemukan · TPB UNU Purwokerto";
          return;
        }
        setPage(result);
        setState("ready");
        document.title = result.seoTitle || `${result.title} · TPB UNU Purwokerto`;
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", result.seoDescription || "");
        requestAnimationFrame(() => scrollToHash(window.location.hash));
      })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    const onHash = () => scrollToHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (site.status === "loading" || state === "loading") {
    return <div className="grid min-h-screen place-items-center bg-cream text-midnight/60"><p className="animate-pulse">Memuat konten…</p></div>;
  }
  if (site.status === "empty") {
    return <Screen title="Konten belum dikonfigurasi" message="Atur seluruh konten situs melalui Panel Admin." action={{ label: "Buka Panel Admin", href: "#admin" }} />;
  }
  if (site.status === "error" || !site.settings) {
    return <Screen title="Gagal memuat situs" message={site.message ?? "Terjadi kesalahan saat memuat pengaturan situs."} action={{ label: "Coba lagi", href: window.location.href }} />;
  }
  if (state === "notfound") {
    return <Screen title="404 — Halaman tidak ditemukan" message="Periksa kembali alamat yang Anda tuju." action={{ label: "Kembali ke Beranda", href: "/" }} />;
  }
  if (state === "error" || !page) {
    return <Screen title="Gagal memuat halaman" message="Terjadi kesalahan saat memuat konten halaman." action={{ label: "Muat ulang", href: window.location.href }} />;
  }

  const settings = site.settings;
  const pmbPrograms = page.blocks
    .filter((block): block is Extract<typeof block, { type: "programs" }> => block.type === "programs")
    .flatMap((block) => block.data.cards.map((card) => card.title));
  const onDaftar = () => {
    const url = settings.pmbLink.trim();
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener");
    else setPmb(true);
  };

  return (
    <div className="min-h-full bg-cream font-sans text-midnight">
      <Header brand={settings.brand} navigation={site.nav} blocks={page.blocks} slug={slug} onAdmin={() => { window.location.hash = "admin"; }} />
      <main>
        {page.blocks.map((block, index) => <BlockRenderer key={block.id ?? `blok-${index}`} block={block} onDaftar={onDaftar} />)}
      </main>
      <Footer footer={settings.footer} />
      <BackToTop />
      {pmb && <Pmb onClose={() => setPmb(false)} programs={pmbPrograms} />}
    </div>
  );
}
