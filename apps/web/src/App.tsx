import { lazy, Suspense, useEffect, useState } from "react";
import type { PublicPage } from "@tpb/contracts";
import { Pmb } from "./components/Pmb";
import { BlockRenderer } from "./components/public/Blocks";
import { BackToTop, Footer } from "./components/public/Footer";
import { Header } from "./components/public/Hero";
import { useReveal } from "./components/public/ui";
import { api } from "./lib/api";
import { scrollOrResolve } from "./lib/anchors";
import { slugFromPath, useAdminRoute, usePathname } from "./lib/router";
import { SiteProvider, useSite } from "./lib/site";
import { useSystemTexts } from "./lib/systemTexts";

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
  const texts = useSystemTexts();
  const { titleSuffix, notFoundTitle, errorTitle } = texts;
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const [page, setPage] = useState<PublicPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [pmb, setPmb] = useState(false);
  const [mountedBlocks, setMountedBlocks] = useState(0);
  useReveal();

  useEffect(() => {
    if (!page) {
      setMountedBlocks(0);
      return;
    }
    const target = window.location.hash && window.location.hash !== "#" ? page.blocks.length : 0;
    setMountedBlocks(target);
    if (target >= page.blocks.length) return;
    let count = target;
    let frame = requestAnimationFrame(function step() {
      count = count === 0 ? 1 : Math.min(count + 4, page.blocks.length);
      setMountedBlocks(count);
      if (count < page.blocks.length) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);

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
          return;
        }
        setPage(result);
        setState("ready");
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", result.seoDescription || "");
        requestAnimationFrame(() => scrollOrResolve(slug, window.location.hash));
      })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (state === "notfound") document.title = `${notFoundTitle} · ${titleSuffix}`;
    else if (state === "error") document.title = `${errorTitle} · ${titleSuffix}`;
    else if (state === "ready" && page) document.title = page.seoTitle || `${page.title} · ${titleSuffix}`;
  }, [state, page, notFoundTitle, errorTitle, titleSuffix]);

  useEffect(() => {
    const onHash = () => scrollOrResolve(slugFromPath(window.location.pathname), window.location.hash);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("tpb:navigate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("tpb:navigate", onHash);
    };
  }, []);

  if (site.status === "loading" || state === "loading") {
    return <div className="grid min-h-screen place-items-center bg-cream text-midnight/60"><p className="animate-pulse">{texts.loading}</p></div>;
  }
  if (site.status === "empty") {
    return <Screen title="Konten belum dikonfigurasi" message="Atur seluruh konten situs melalui Panel Admin." action={{ label: "Buka Panel Admin", href: "#admin" }} />;
  }
  if (site.status === "error" || !site.settings) {
    return <Screen title={texts.errorTitle} message={site.message ?? texts.errorBody} action={{ label: "Coba lagi", href: window.location.href }} />;
  }
  if (state === "notfound") {
    return <Screen title={texts.notFoundTitle} message={texts.notFoundBody} action={{ label: texts.backLabel, href: "/" }} />;
  }
  if (state === "error" || !page) {
    return <Screen title={texts.errorTitle} message={texts.errorBody} action={{ label: "Muat ulang", href: window.location.href }} />;
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
        {page.blocks.slice(0, mountedBlocks).map((block, index) => <BlockRenderer key={block.id ?? `blok-${index}`} block={block} onDaftar={onDaftar} />)}
      </main>
      {mountedBlocks >= page.blocks.length ? <Footer footer={settings.footer} /> : null}
      <BackToTop />
      {pmb && <Pmb onClose={() => setPmb(false)} programs={pmbPrograms} />}
    </div>
  );
}
