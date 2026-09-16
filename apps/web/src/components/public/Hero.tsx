import { useEffect, useRef, useState } from "react";
import type { Block, NavItemInput, SiteContent } from "@tpb/contracts";
import { Crest } from "./ui";
import { SearchButton } from "./Search";
import { DriveImage } from "../DriveImage";
import { imageSrcSet } from "../../lib/drive";
import { navigate } from "../../lib/router";

function handleInternal(href: string) {
  if (href.startsWith("/")) {
    navigate(href);
    return true;
  }
  return false;
}

export function Header({ brand, navigation, blocks, slug, onAdmin }: { brand: SiteContent["brand"]; navigation: NavItemInput[]; blocks: Block[]; slug: string; onAdmin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => setLogoFailed(false), [brand.logoUrl]);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 24); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  useEffect(() => {
    if (open === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      triggers.current.get(open)?.focus();
      setOpen(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const linkClass = "rounded-full px-4 py-2.5 text-[12px] font-bold text-midnight/70 transition hover:bg-midnight/5 hover:text-midnight";
  const instagramHref = navigation.reduce<string | null>((found, item) => found ?? item.children?.find((child) => /instagram\.com/i.test(child.href))?.href ?? null, null);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className={`transition-all duration-500 ${scrolled ? "bg-cream/85 backdrop-blur-xl shadow-[0_10px_40px_-24px_rgba(14,16,68,0.6)]" : "bg-cream/0"}`}>
        <div className="mx-auto flex max-w-[1360px] items-center gap-6 px-5 py-3.5 lg:px-10">
          <a href="/" onClick={(event) => { if (handleInternal("/")) event.preventDefault(); }} className="flex shrink-0 items-center gap-3">
            {brand.logoUrl && !logoFailed ? <DriveImage src={brand.logoUrl} alt={`${brand.name} logo`} className="h-11 w-11 object-contain drop-shadow-sm" onError={() => setLogoFailed(true)} /> : <Crest className="h-11 w-11 drop-shadow-sm" />}
            <span className="leading-none">
              <span className="block font-mono text-[9px] font-medium uppercase tracking-[0.32em] text-leaf-600">{brand.kicker}</span>
              <span className="block font-display text-[15px] font-extrabold leading-tight text-midnight">{brand.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-midnight/55">{brand.org}</span>
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-0.5 xl:flex" onMouseLeave={() => setOpen(null)}>
            {navigation.map((item) => (
              <div key={`${item.label}-${item.href}`} className="relative" onPointerEnter={(event) => { if (event.pointerType !== "touch") setOpen(item.label); }}>
                {item.children?.length ? (
                  <button ref={(node) => { if (node) triggers.current.set(item.label, node); else triggers.current.delete(item.label); }} type="button" aria-expanded={open === item.label} onClick={() => setOpen((current) => (current === item.label ? null : item.label))} className={linkClass}>{item.label}</button>
                ) : (
                  <a href={item.href} onClick={(event) => { if (handleInternal(item.href)) event.preventDefault(); }} className={linkClass}>{item.label}</a>
                )}
                {item.children?.length && open === item.label ? (
                  <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-2xl border border-midnight/10 bg-white p-2 shadow-xl">
                    {item.children.map((child) => (
                      <div key={`${child.label}-${child.href}`}>
                        <a href={child.href} target={child.openInNewTab ? "_blank" : undefined} rel={child.openInNewTab ? "noopener noreferrer" : undefined} onClick={(event) => { if (handleInternal(child.href)) event.preventDefault(); }} className="block rounded-xl px-3 py-2 text-sm text-midnight/70 hover:bg-cream hover:text-midnight">{child.label}</a>
                        {child.children?.length ? <div className="ml-3 border-l border-midnight/10 pl-2">{child.children.map((grand) => <a key={`${grand.label}-${grand.href}`} href={grand.href} target={grand.openInNewTab ? "_blank" : undefined} rel={grand.openInNewTab ? "noopener noreferrer" : undefined} onClick={(event) => { if (handleInternal(grand.href)) event.preventDefault(); }} className="block rounded-lg px-3 py-1.5 text-xs text-midnight/55 hover:bg-cream hover:text-midnight">{grand.label}</a>)}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <SearchButton blocks={blocks} navigation={navigation} slug={slug} />
            {instagramHref && <a href={instagramHref} target="_blank" rel="noopener noreferrer" aria-label="Instagram TPB" title="Instagram TPB" className="grid h-9 w-9 place-items-center rounded-full border border-midnight/15 text-midnight/70 transition hover:-translate-y-0.5 hover:border-gold hover:text-midnight"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg></a>}
            <button onClick={onAdmin} className="rounded-full bg-midnight px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-midnight-700">Admin</button>
          </nav>

          <div className="ml-auto flex items-center gap-2 xl:hidden">
            <SearchButton blocks={blocks} navigation={navigation} slug={slug} compact />
            <button onClick={() => setMobile((v) => !v)} aria-label="Menu" aria-expanded={mobile} className="rounded-full border border-midnight/15 px-4 py-2 text-xs font-bold">☰</button>
          </div>
        </div>

        {mobile && (
          <div className="mx-4 mb-3 rounded-2xl border border-midnight/10 bg-white p-3 shadow-xl xl:hidden">
            {navigation.map((item) => (
              <div key={`${item.label}-${item.href}`}>
                <a href={item.href} onClick={(event) => { setMobile(false); if (handleInternal(item.href)) event.preventDefault(); }} className="block rounded-xl px-3 py-2 text-sm font-bold text-midnight/80 hover:bg-cream">{item.label}</a>
                {item.children?.map((child) => (
                  <a key={`${child.label}-${child.href}`} href={child.href} onClick={(event) => { setMobile(false); if (handleInternal(child.href)) event.preventDefault(); }} className="block rounded-xl px-6 py-2 text-sm text-midnight/60 hover:bg-cream">{child.label}</a>
                ))}
              </div>
            ))}
            {instagramHref && <a href={instagramHref} target="_blank" rel="noopener noreferrer" onClick={() => setMobile(false)} className="block rounded-xl px-3 py-2 text-sm font-bold text-midnight/80 hover:bg-cream">Instagram</a>}
            <button onClick={() => { setMobile(false); onAdmin(); }} className="mt-2 w-full rounded-xl bg-midnight px-3 py-2 text-sm font-bold text-white">Panel Admin</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function Hero({ hero, onDaftar, anchor = "top" }: { hero: SiteContent["hero"]; onDaftar: () => void; anchor?: string }) {
  return <section id={anchor} className="relative min-h-[100svh] scroll-mt-24 overflow-hidden bg-midnight"><div className="absolute inset-0"><DriveImage src={hero.image} alt="" className="h-full w-full object-cover opacity-45" loading="eager" fetchPriority="high" sizes="100vw" srcSet={hero.image ? imageSrcSet(hero.image) : undefined} width={1920} height={1080} /><div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/20" /></div><div className="relative mx-auto flex min-h-[100svh] max-w-[1360px] items-center px-5 pb-16 pt-24 lg:px-10"><div className="max-w-3xl text-white"><span className="reveal inline-flex rounded-full border border-gold/50 bg-gold/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-gold">{hero.badge}</span><h1 className="reveal mt-6 font-display text-[2.6rem] font-extrabold leading-[1.02] lg:text-7xl">{hero.line1}<br /><span className="text-gold">{hero.highlight}</span><br />{hero.line2}</h1><p className="reveal mt-6 max-w-xl text-[15px] leading-relaxed text-white/75 lg:text-base">{hero.subtitle}</p><div className="reveal mt-8 flex flex-wrap gap-3"><button onClick={onDaftar} className="rounded-full bg-gold px-7 py-3.5 text-sm font-extrabold text-midnight transition hover:-translate-y-0.5">{hero.primaryLabel}</button>{hero.secondaryLabel && <a href={hero.secondaryHref || hero.primaryHref || "#top"} className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">{hero.secondaryLabel}</a>}</div></div></div></section>;
}

export function Marquee({ items, anchor }: { items: string[]; anchor?: string }) { return <div id={anchor} className="scroll-mt-24 overflow-hidden bg-gold py-3 text-midnight"><div className="marquee-track flex min-w-max gap-8 font-mono text-xs font-bold uppercase tracking-[0.2em]">{[...items, ...items].map((item, index) => <span key={`${item}-${index}`} className="flex items-center gap-8">{item}<span>✦</span></span>)}</div></div>; }
